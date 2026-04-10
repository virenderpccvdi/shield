package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.AccessScheduleRequest;
import com.rstglobal.shield.dns.dto.response.AccessScheduleResponse;
import com.rstglobal.shield.dns.entity.AccessSchedule;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.AccessScheduleRepository;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * PO-06 — Advanced Parental Control Schedule.
 * <p>
 * Manages named access-window rules per child profile.  Each rule defines
 * which days of the week (bitmask) and between which times DNS access is
 * permitted.  When a profile's current time falls outside ALL of its active
 * blocking rules, the {@code __access_locked__} sentinel is inserted into
 * {@code dns_rules.enabled_categories}, cutting off all internet access.
 * <p>
 * The enforcement scheduler runs every 60 seconds and is careful to write to
 * the database only when the sentinel state actually changes, minimising
 * unnecessary DB writes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccessScheduleService {

    /**
     * Sentinel key stored in {@code dns_rules.enabled_categories} to indicate
     * that at least one active access-schedule rule is currently blocking the
     * profile.  The same pattern is used by {@link BedtimeLockService} and
     * {@link ScheduleService}.
     */
    public static final String ACCESS_LOCKED_KEY = "__access_locked__";

    private final AccessScheduleRepository accessScheduleRepo;
    private final DnsRulesRepository dnsRulesRepo;
    private final DnsRulesService dnsRulesService;

    // ── CRUD ──────────────────────────────────────────────────────────────────

    /** Returns all schedules for the given profile (active and inactive). */
    @Transactional(readOnly = true)
    public List<AccessScheduleResponse> getSchedules(UUID profileId) {
        return accessScheduleRepo.findByProfileId(profileId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** Creates a new access-schedule rule for the given profile. */
    @Transactional
    public AccessScheduleResponse createSchedule(UUID profileId, AccessScheduleRequest req) {
        AccessSchedule schedule = AccessSchedule.builder()
                .profileId(profileId)
                .name(req.getName())
                .isActive(Boolean.TRUE.equals(req.getIsActive()))
                .daysBitmask(req.getDaysBitmask())
                .allowStart(parseTime(req.getAllowStart()))
                .allowEnd(parseTime(req.getAllowEnd()))
                .blockOutside(Boolean.TRUE.equals(req.getBlockOutside()))
                .build();

        schedule = accessScheduleRepo.save(schedule);

        // Immediately enforce so the new rule takes effect without waiting for the scheduler
        enforceForProfile(profileId);

        log.info("AccessSchedule created: id={} profileId={} name={} days={} start={} end={}",
                schedule.getId(), profileId, schedule.getName(),
                schedule.getDaysBitmask(), schedule.getAllowStart(), schedule.getAllowEnd());
        return toResponse(schedule);
    }

    /** Updates an existing access-schedule rule. */
    @Transactional
    public AccessScheduleResponse updateSchedule(UUID scheduleId, AccessScheduleRequest req) {
        AccessSchedule schedule = accessScheduleRepo.findById(scheduleId)
                .orElseThrow(() -> ShieldException.notFound("access-schedule", scheduleId.toString()));

        schedule.setName(req.getName());
        schedule.setActive(Boolean.TRUE.equals(req.getIsActive()));
        schedule.setDaysBitmask(req.getDaysBitmask());
        schedule.setAllowStart(parseTime(req.getAllowStart()));
        schedule.setAllowEnd(parseTime(req.getAllowEnd()));
        schedule.setBlockOutside(Boolean.TRUE.equals(req.getBlockOutside()));

        schedule = accessScheduleRepo.save(schedule);

        // Re-evaluate enforcement immediately
        enforceForProfile(schedule.getProfileId());

        log.info("AccessSchedule updated: id={} profileId={} name={}",
                scheduleId, schedule.getProfileId(), schedule.getName());
        return toResponse(schedule);
    }

    /** Deletes an access-schedule rule and re-evaluates enforcement immediately. */
    @Transactional
    public void deleteSchedule(UUID scheduleId) {
        AccessSchedule schedule = accessScheduleRepo.findById(scheduleId)
                .orElseThrow(() -> ShieldException.notFound("access-schedule", scheduleId.toString()));
        UUID profileId = schedule.getProfileId();
        accessScheduleRepo.delete(schedule);

        // After deletion, re-check — remaining rules may still lock the profile
        enforceForProfile(profileId);

        log.info("AccessSchedule deleted: id={} profileId={}", scheduleId, profileId);
    }

    /**
     * Returns whether the profile currently has at least one active schedule
     * whose window allows access right now.  If none of the active
     * blockOutside=true rules allow access, returns false.
     * <p>
     * Note: if there are no active blockOutside rules at all, access is allowed
     * (absence of restriction = open).
     */
    @Transactional(readOnly = true)
    public boolean isAccessAllowed(UUID profileId) {
        List<AccessSchedule> active = accessScheduleRepo.findByProfileId(profileId)
                .stream()
                .filter(AccessSchedule::isActive)
                .filter(AccessSchedule::isBlockOutside)
                .toList();

        if (active.isEmpty()) {
            // No active blocking rules — access is open
            return true;
        }
        // Access is allowed if the current moment falls inside ANY active rule's window
        return active.stream().anyMatch(this::isCurrentlyAllowed);
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────

    /**
     * Every minute: evaluate all active blockOutside=true schedules and apply
     * or remove the {@code __access_locked__} sentinel in each affected
     * profile's {@code dns_rules.enabled_categories}.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void enforceSchedules() {
        List<AccessSchedule> candidates = accessScheduleRepo.findByIsActiveTrueAndBlockOutsideTrue();
        if (candidates.isEmpty()) return;

        // Group by profileId so we evaluate all rules for each profile together
        Map<UUID, List<AccessSchedule>> byProfile = new LinkedHashMap<>();
        for (AccessSchedule s : candidates) {
            byProfile.computeIfAbsent(s.getProfileId(), k -> new ArrayList<>()).add(s);
        }

        log.debug("AccessSchedule enforcement tick: {} profiles with active blocking rules", byProfile.size());

        for (Map.Entry<UUID, List<AccessSchedule>> entry : byProfile.entrySet()) {
            UUID profileId = entry.getKey();
            try {
                evaluateAndApply(profileId, entry.getValue());
            } catch (Exception e) {
                log.warn("AccessSchedule enforcement failed for profileId={}: {}", profileId, e.getMessage());
            }
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Evaluates whether access should be locked for the given profile based on
     * the provided set of active blocking rules, then updates the sentinel in
     * {@code dns_rules.enabled_categories} if the state has changed.
     */
    private void evaluateAndApply(UUID profileId, List<AccessSchedule> rules) {
        // Access is BLOCKED when NO active rule's window currently allows it
        boolean shouldBeLocked = rules.stream().noneMatch(this::isCurrentlyAllowed);

        dnsRulesRepo.findByProfileId(profileId).ifPresent(dnsRules -> {
            Map<String, Boolean> cats = Optional.ofNullable(dnsRules.getEnabledCategories())
                    .map(LinkedHashMap::new)
                    .orElse(new LinkedHashMap<>());

            boolean currentlyLocked = Boolean.TRUE.equals(cats.get(ACCESS_LOCKED_KEY));

            if (shouldBeLocked != currentlyLocked) {
                if (shouldBeLocked) {
                    cats.put(ACCESS_LOCKED_KEY, true);
                } else {
                    cats.remove(ACCESS_LOCKED_KEY);
                }
                dnsRules.setEnabledCategories(cats);
                dnsRulesRepo.save(dnsRules);

                // Broadcast rules to shield-dns-resolver immediately so the change takes effect
                try {
                    dnsRulesService.syncRules(profileId);
                } catch (Exception e) {
                    log.warn("AccessSchedule rules broadcast failed for profileId={}: {}", profileId, e.getMessage());
                }

                log.info("AccessSchedule lock {}: profileId={}",
                        shouldBeLocked ? "ACTIVATED" : "DEACTIVATED", profileId);
            }
        });
    }

    /**
     * Re-evaluates and applies the access lock for a single profile.
     * Called immediately after CRUD operations so changes take effect
     * without waiting for the next scheduler tick.
     */
    private void enforceForProfile(UUID profileId) {
        List<AccessSchedule> active = accessScheduleRepo.findByProfileId(profileId)
                .stream()
                .filter(AccessSchedule::isActive)
                .filter(AccessSchedule::isBlockOutside)
                .toList();

        if (active.isEmpty()) {
            // No active blocking rules remain — remove any existing lock
            dnsRulesRepo.findByProfileId(profileId).ifPresent(dnsRules -> {
                Map<String, Boolean> cats = Optional.ofNullable(dnsRules.getEnabledCategories())
                        .map(LinkedHashMap::new)
                        .orElse(new LinkedHashMap<>());
                if (cats.containsKey(ACCESS_LOCKED_KEY)) {
                    cats.remove(ACCESS_LOCKED_KEY);
                    dnsRules.setEnabledCategories(cats);
                    dnsRulesRepo.save(dnsRules);
                    try {
                        dnsRulesService.syncRules(profileId);
                    } catch (Exception e) {
                        log.warn("AccessSchedule rules broadcast (clear) failed for profileId={}: {}",
                                profileId, e.getMessage());
                    }
                }
            });
            return;
        }

        evaluateAndApply(profileId, active);
    }

    /**
     * Determines whether the given schedule's window covers the current moment.
     * <p>
     * Day matching: uses the day-of-week bitmask (bit 0 = Monday, …, bit 6 = Sunday).
     * Java's {@code DayOfWeek.getValue()} returns 1=Mon…7=Sun; we shift by
     * {@code (value - 1)} to get bit 0=Mon…bit 6=Sun.
     * <p>
     * Time matching: access is allowed when
     * {@code allowStart <= now < allowEnd}.  Overnight windows (allowStart after
     * allowEnd) are handled by the split-range check.
     */
    boolean isCurrentlyAllowed(AccessSchedule schedule) {
        LocalDateTime now = LocalDateTime.now();

        // Bit position for today: Mon=0, Tue=1, …, Sun=6
        int dayBit = now.getDayOfWeek().getValue() - 1; // getValue: Mon=1..Sun=7 → 0..6
        boolean dayMatches = (schedule.getDaysBitmask() & (1 << dayBit)) != 0;
        if (!dayMatches) {
            // Today is not a day this rule covers — not blocked by this rule,
            // so this rule does NOT grant access (return false means this rule
            // does not satisfy the "currently allowed" check)
            return false;
        }

        LocalTime time  = now.toLocalTime();
        LocalTime start = schedule.getAllowStart();
        LocalTime end   = schedule.getAllowEnd();

        if (start.isBefore(end) || start.equals(end)) {
            // Normal window: allowed when start <= now < end
            return !time.isBefore(start) && time.isBefore(end);
        } else {
            // Overnight window (e.g. 22:00 → 06:00): allowed when now >= start OR now < end
            return !time.isBefore(start) || time.isBefore(end);
        }
    }

    private LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            throw ShieldException.badRequest("Time value must not be blank");
        }
        try {
            return LocalTime.parse(value);
        } catch (Exception e) {
            throw ShieldException.badRequest("Invalid time format '" + value + "', expected HH:mm");
        }
    }

    private AccessScheduleResponse toResponse(AccessSchedule s) {
        return AccessScheduleResponse.builder()
                .id(s.getId())
                .profileId(s.getProfileId())
                .name(s.getName())
                .isActive(s.isActive())
                .daysBitmask(s.getDaysBitmask())
                .allowStart(s.getAllowStart() != null ? s.getAllowStart().toString() : null)
                .allowEnd(s.getAllowEnd() != null ? s.getAllowEnd().toString() : null)
                .blockOutside(s.isBlockOutside())
                .currentlyAllowed(isCurrentlyAllowed(s))
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
