package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ScheduleOverrideRequest;
import com.rstglobal.shield.dns.dto.request.UpdateScheduleRequest;
import com.rstglobal.shield.dns.dto.response.ScheduleResponse;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.entity.Schedule;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import com.rstglobal.shield.dns.repository.ScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleService {

    /**
     * Special key stored in dns_rules.enabled_categories to signal that the
     * schedule grid is currently in a "blocked" hour.  The key is read by
     * AdGuard sync / any DNS-filter logic that checks enabled_categories.
     */
    public static final String SCHEDULE_BLOCKED_KEY = "__schedule_blocked__";

    private final ScheduleRepository scheduleRepo;
    private final DnsRulesRepository dnsRulesRepo;
    private final BudgetTrackingService budgetTracking;

    @Transactional
    public Schedule initSchedule(UUID tenantId, UUID profileId) {
        if (scheduleRepo.existsByProfileId(profileId)) {
            return scheduleRepo.findByProfileId(profileId).get();
        }
        Schedule s = Schedule.builder()
                .tenantId(tenantId)
                .profileId(profileId)
                .grid(defaultGrid())
                .build();
        return scheduleRepo.save(s);
    }

    @Transactional
    public ScheduleResponse getSchedule(UUID profileId, UUID tenantId) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).tenantId(tenantId).grid(defaultGrid()).build()));
        return toResponse(s);
    }

    @Transactional
    public ScheduleResponse updateSchedule(UUID profileId, UpdateScheduleRequest req, UUID tenantId) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).tenantId(tenantId).grid(defaultGrid()).build()));
        s.setGrid(req.getGrid());
        s.setActivePreset(req.getActivePreset());
        return toResponse(scheduleRepo.save(s));
    }

    @Transactional
    public ScheduleResponse applyPreset(UUID profileId, String preset, UUID tenantId) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).tenantId(tenantId).grid(defaultGrid()).build()));
        s.setGrid(gridForPreset(preset));
        s.setActivePreset(preset);
        return toResponse(scheduleRepo.save(s));
    }

    @Transactional
    public ScheduleResponse applyOverride(UUID profileId, ScheduleOverrideRequest req, UUID tenantId) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).tenantId(tenantId).grid(defaultGrid()).build()));
        s.setOverrideActive(true);
        s.setOverrideType(req.getOverrideType());
        s.setOverrideEndsAt(req.getDurationMinutes() > 0
                ? OffsetDateTime.now().plusMinutes(req.getDurationMinutes())
                : null);
        return toResponse(scheduleRepo.save(s));
    }

    @Transactional
    public ScheduleResponse cancelOverride(UUID profileId, UUID tenantId) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).tenantId(tenantId).grid(defaultGrid()).build()));
        s.setOverrideActive(false);
        s.setOverrideType(null);
        s.setOverrideEndsAt(null);
        return toResponse(scheduleRepo.save(s));
    }

    /** Scheduled: expire overrides every minute. */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireOverrides() {
        OffsetDateTime now = OffsetDateTime.now();
        List<Schedule> expired = scheduleRepo.findExpiredOverrides(now);
        for (Schedule s : expired) {
            s.setOverrideActive(false);
            s.setOverrideType(null);
            s.setOverrideEndsAt(null);
            scheduleRepo.save(s);
            log.info("Override expired for profileId={}", s.getProfileId());
        }
    }

    // ── Schedule enforcement (runs every minute) ───────────────────────────────

    /**
     * Every minute: check every profile's schedule grid against the current
     * local hour and set/clear the {@code __schedule_blocked__} flag in
     * dns_rules.enabled_categories so AdGuard sync and DNS filtering can
     * honour the schedule.
     *
     * <p>Override rules:
     * <ul>
     *   <li>PAUSE  → always blocked regardless of grid</li>
     *   <li>HOMEWORK / FOCUS / BEDTIME_NOW → always blocked regardless of grid</li>
     *   <li>No active override → grid determines blocked/allowed</li>
     * </ul>
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void enforceSchedules() {
        OffsetDateTime now = OffsetDateTime.now(ZoneId.systemDefault());
        int hour = now.getHour();
        DayOfWeek dow = now.getDayOfWeek();
        // Map Java DayOfWeek (MON=1..SUN=7) to grid keys
        String dayKey = switch (dow) {
            case MONDAY    -> "monday";
            case TUESDAY   -> "tuesday";
            case WEDNESDAY -> "wednesday";
            case THURSDAY  -> "thursday";
            case FRIDAY    -> "friday";
            case SATURDAY  -> "saturday";
            case SUNDAY    -> "sunday";
        };

        // Performance fix: only load profiles that have blocked hours today OR an active override.
        // This avoids a full-table scan on every minute tick for platforms with many profiles.
        List<Schedule> schedules = scheduleRepo.findSchedulesActiveForDay(dayKey);
        int blocked = 0, allowed = 0;

        for (Schedule s : schedules) {
            boolean shouldBlock;

            if (Boolean.TRUE.equals(s.getOverrideActive())) {
                // Any active override = block all internet for the child
                shouldBlock = true;
            } else {
                // Check grid: 1 = blocked, 0 = allowed
                List<Integer> hours = s.getGrid() != null ? s.getGrid().get(dayKey) : null;
                shouldBlock = hours != null && hours.size() > hour && hours.get(hour) == 1;
            }

            // Also block if the daily budget (daily_budget_minutes) is exhausted
            // regardless of the schedule grid — budget exhaustion takes precedence
            final UUID profileId = s.getProfileId();
            final boolean budgetExhausted = dnsRulesRepo.findByProfileId(profileId)
                    .map(r -> {
                        Integer limit = r.getDailyBudgetMinutes();
                        if (limit == null || limit <= 0) return false;
                        int used = budgetTracking.getUsedMinutesToday(profileId);
                        return used >= limit;
                    })
                    .orElse(false);
            if (budgetExhausted) {
                shouldBlock = true;
            }

            // Write __schedule_blocked__ flag into the corresponding DnsRules row
            // and trigger AdGuard sync only when the value changes
            final boolean finalShouldBlock = shouldBlock;
            dnsRulesRepo.findByProfileId(profileId).ifPresent(rules -> {
                Map<String, Boolean> cats = rules.getEnabledCategories();
                if (cats == null) cats = new LinkedHashMap<>();
                Boolean current = cats.get(SCHEDULE_BLOCKED_KEY);
                if (!Objects.equals(current, finalShouldBlock)) {
                    cats.put(SCHEDULE_BLOCKED_KEY, finalShouldBlock);
                    rules.setEnabledCategories(new LinkedHashMap<>(cats));
                    dnsRulesRepo.save(rules);
                    log.info("Schedule enforcement: profileId={} day={} hour={} blocked={} (budgetExhausted={})",
                            profileId, dayKey, hour, finalShouldBlock, budgetExhausted);
                }
            });

            if (shouldBlock) blocked++; else allowed++;
        }

        if (!schedules.isEmpty()) {
            log.debug("Schedule enforcement tick: {} profiles blocked, {} allowed", blocked, allowed);
        }

        // Clear stale __schedule_blocked__ flags for profiles that are no longer in the
        // active-for-day set (e.g. their blocked hour just ended). We only touch rows
        // where the flag is currently TRUE to avoid unnecessary DB writes.
        Set<UUID> activeProfileIds = schedules.stream()
                .map(Schedule::getProfileId)
                .collect(java.util.stream.Collectors.toSet());
        dnsRulesRepo.findAllWithScheduleBlocked().forEach(rules -> {
            if (!activeProfileIds.contains(rules.getProfileId())) {
                Map<String, Boolean> cats = rules.getEnabledCategories();
                if (cats != null && Boolean.TRUE.equals(cats.get(SCHEDULE_BLOCKED_KEY))) {
                    cats = new LinkedHashMap<>(cats);
                    cats.put(SCHEDULE_BLOCKED_KEY, false);
                    rules.setEnabledCategories(cats);
                    dnsRulesRepo.save(rules);
                    log.info("Schedule enforcement: cleared stale block for profileId={}", rules.getProfileId());
                }
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Schedule findOrThrow(UUID profileId) {
        return scheduleRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("schedule", profileId.toString()));
    }

    /** Default: all hours allowed (all zeros). */
    private Map<String, List<Integer>> defaultGrid() {
        List<String> days = List.of("monday","tuesday","wednesday","thursday","friday","saturday","sunday");
        Map<String, List<Integer>> grid = new LinkedHashMap<>();
        for (String day : days) {
            List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
            grid.put(day, hours);
        }
        return grid;
    }

    private Map<String, List<Integer>> gridForPreset(String preset) {
        Map<String, List<Integer>> grid = defaultGrid();
        return switch (preset) {
            case "SCHOOL" -> {
                // Block 8am-4pm Mon-Fri
                List<String> weekdays = List.of("monday","tuesday","wednesday","thursday","friday");
                for (String day : weekdays) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
                    for (int h = 8; h < 16; h++) hours.set(h, 1);
                    grid.put(day, hours);
                }
                yield grid;
            }
            case "BEDTIME" -> {
                // Block 10pm-7am every day
                for (String day : grid.keySet()) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
                    for (int h = 22; h < 24; h++) hours.set(h, 1);
                    for (int h = 0; h < 7; h++) hours.set(h, 1);
                    grid.put(day, hours);
                }
                yield grid;
            }
            case "STRICT" -> {
                // Block 8am-4pm weekdays + 10pm-7am all days
                List<String> weekdays = List.of("monday","tuesday","wednesday","thursday","friday");
                for (String day : grid.keySet()) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
                    if (weekdays.contains(day)) for (int h = 8; h < 16; h++) hours.set(h, 1);
                    for (int h = 22; h < 24; h++) hours.set(h, 1);
                    for (int h = 0; h < 7; h++) hours.set(h, 1);
                    grid.put(day, hours);
                }
                yield grid;
            }
            case "WEEKEND" -> {
                // Weekdays fully blocked, weekends fully open
                List<String> weekdays = List.of("monday","tuesday","wednesday","thursday","friday");
                for (String day : grid.keySet()) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, weekdays.contains(day) ? 1 : 0));
                    grid.put(day, hours);
                }
                yield grid;
            }
            default -> grid;
        };
    }

    private ScheduleResponse toResponse(Schedule s) {
        return ScheduleResponse.builder()
                .profileId(s.getProfileId())
                .grid(s.getGrid())
                .activePreset(s.getActivePreset())
                .overrideActive(s.getOverrideActive())
                .overrideType(s.getOverrideType())
                .overrideEndsAt(s.getOverrideEndsAt())
                .build();
    }

}
