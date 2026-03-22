package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * PC-01 — Bedtime Internet Lock
 * <p>
 * When a parent-configured bedtime window is active, all DNS queries for the
 * child's profile are blocked by setting a special sentinel key in
 * {@code enabled_categories}.  The existing {@code syncToAdGuard} logic in
 * {@link DnsRulesService} already checks this key and disables filtering for
 * the AdGuard client, cutting off all internet access for the duration.
 * <p>
 * The lock activates/deactivates automatically every minute via a scheduled
 * check.  Overnight windows (e.g. 21:00 → 07:00) are handled correctly.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BedtimeLockService {

    /** Sentinel key stored in {@code dns_rules.enabled_categories} to signal bedtime lock. */
    public static final String BEDTIME_LOCKED_KEY = "__bedtime_locked__";

    private final DnsRulesRepository dnsRulesRepository;
    private final DnsRulesService dnsRulesService;

    // ── Configure ─────────────────────────────────────────────────────────────

    /**
     * Configure (or update) the bedtime lock for a profile.
     *
     * @param profileId    child profile UUID
     * @param enabled      whether bedtime lock is active
     * @param bedtimeStart "HH:mm" string for lock start (e.g. "21:00")
     * @param bedtimeEnd   "HH:mm" string for lock end   (e.g. "07:00")
     * @return current status map
     */
    @Transactional
    public Map<String, Object> configure(UUID profileId, boolean enabled, String bedtimeStart, String bedtimeEnd) {
        DnsRules rules = findRules(profileId);

        rules.setBedtimeEnabled(enabled);
        rules.setBedtimeStart(bedtimeStart != null && !bedtimeStart.isBlank()
                ? LocalTime.parse(bedtimeStart) : null);
        rules.setBedtimeEnd(bedtimeEnd != null && !bedtimeEnd.isBlank()
                ? LocalTime.parse(bedtimeEnd) : null);

        // Re-evaluate whether the lock should be active right now and update the marker
        boolean shouldBeLocked = enabled && isBedtimeActive(rules);
        applyMarker(rules, shouldBeLocked);

        dnsRulesRepository.save(rules);

        // Push to AdGuard immediately so the change takes effect without waiting for scheduler
        try {
            dnsRulesService.syncRules(profileId);
        } catch (Exception e) {
            log.warn("Bedtime configure: AdGuard sync failed for profileId={}: {}", profileId, e.getMessage());
        }

        log.info("Bedtime lock configured: profileId={} enabled={} start={} end={} activatedNow={}",
                profileId, enabled, bedtimeStart, bedtimeEnd, shouldBeLocked);
        return buildStatus(rules);
    }

    // ── Status ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getStatus(UUID profileId) {
        DnsRules rules = dnsRulesRepository.findByProfileId(profileId).orElse(null);
        if (rules == null) {
            return Map.of("enabled", false, "active", false, "bedtimeStart", "", "bedtimeEnd", "");
        }
        return buildStatus(rules);
    }

    // ── Scheduler — runs every minute ─────────────────────────────────────────

    /**
     * Every minute: check all profiles that have bedtime lock enabled and
     * activate or deactivate the internet block as needed.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void enforceAll() {
        List<DnsRules> allRules = dnsRulesRepository.findAllWithBedtimeEnabled();
        if (allRules.isEmpty()) return;

        log.debug("Bedtime enforcement check: {} profiles with bedtime enabled", allRules.size());
        for (DnsRules rules : allRules) {
            try {
                boolean shouldBeLocked = isBedtimeActive(rules);
                Map<String, Boolean> cats = Optional.ofNullable(rules.getEnabledCategories())
                        .map(LinkedHashMap::new)
                        .orElse(new LinkedHashMap<>());
                boolean currentlyLocked = Boolean.TRUE.equals(cats.get(BEDTIME_LOCKED_KEY));

                if (shouldBeLocked != currentlyLocked) {
                    applyMarker(rules, shouldBeLocked);
                    dnsRulesRepository.save(rules);
                    dnsRulesService.syncRules(rules.getProfileId());
                    log.info("Bedtime lock {}: profileId={} clientId={}",
                            shouldBeLocked ? "ACTIVATED" : "DEACTIVATED",
                            rules.getProfileId(), rules.getDnsClientId());
                }
            } catch (Exception e) {
                log.warn("Bedtime enforcement failed for profileId={}: {}", rules.getProfileId(), e.getMessage());
            }
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private DnsRules findRules(UUID profileId) {
        return dnsRulesRepository.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
    }

    /**
     * Determines whether the current time falls within the bedtime window.
     * Handles overnight windows (e.g. 21:00 → 07:00) where start is after end.
     */
    boolean isBedtimeActive(DnsRules rules) {
        if (!rules.isBedtimeEnabled() || rules.getBedtimeStart() == null || rules.getBedtimeEnd() == null) {
            return false;
        }
        LocalTime now   = LocalTime.now();
        LocalTime start = rules.getBedtimeStart();
        LocalTime end   = rules.getBedtimeEnd();
        // Overnight window: active when now >= start OR now < end
        if (start.isAfter(end)) {
            return !now.isBefore(start) || now.isBefore(end);
        }
        // Same-day window: active when start <= now < end
        return !now.isBefore(start) && now.isBefore(end);
    }

    /** Adds or removes the bedtime sentinel key in enabled_categories. */
    private void applyMarker(DnsRules rules, boolean lock) {
        Map<String, Boolean> cats = Optional.ofNullable(rules.getEnabledCategories())
                .map(LinkedHashMap::new)
                .orElse(new LinkedHashMap<>());
        if (lock) {
            cats.put(BEDTIME_LOCKED_KEY, true);
        } else {
            cats.remove(BEDTIME_LOCKED_KEY);
        }
        rules.setEnabledCategories(cats);
    }

    private Map<String, Object> buildStatus(DnsRules rules) {
        boolean active = Boolean.TRUE.equals(
                Optional.ofNullable(rules.getEnabledCategories())
                        .map(c -> c.get(BEDTIME_LOCKED_KEY))
                        .orElse(false));
        return Map.of(
                "enabled",      rules.isBedtimeEnabled(),
                "bedtimeStart", rules.getBedtimeStart() != null ? rules.getBedtimeStart().toString() : "",
                "bedtimeEnd",   rules.getBedtimeEnd()   != null ? rules.getBedtimeEnd().toString()   : "",
                "active",       active
        );
    }
}
