package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.dns.client.AdGuardClient;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Tracks daily screen-time usage for child profiles and enforces the
 * {@code daily_budget_minutes} limit stored in {@code dns_rules}.
 *
 * <p>Design:
 * <ul>
 *   <li>Redis key {@code shield:budget:{profileId}:{date}} stores minutes-online today.</li>
 *   <li>{@link #recordActivity(UUID)} is called each time a DNS query is logged for a
 *       profile.  It stamps a "last-seen" key so the scheduler knows the profile was
 *       recently active.</li>
 *   <li>{@link #enforceBudgets()} runs every minute.  For each profile with a
 *       {@code dailyBudgetMinutes} limit it checks whether the profile had DNS activity in
 *       the last 2 minutes (last-seen TTL key still present) and, if so, increments the
 *       daily counter.  When the counter reaches the limit it writes
 *       {@code __budget_exhausted__ = true} into {@code dns_rules.enabled_categories} and
 *       syncs to AdGuard.  When the counter drops back below the limit (e.g. the parent
 *       raised the limit) the flag is cleared.</li>
 *   <li>Keys use a TTL of 2 days so Redis self-cleans.</li>
 * </ul>
 *
 * <p>This service complements {@link BudgetEnforcementService} which handles the
 * per-app/service budgets stored in {@code timeBudgets} JSONB.  Both write the same
 * {@code __budget_exhausted__} flag so either mechanism can trigger the internet cutoff.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BudgetTrackingService {

    /**
     * Special key stored in {@code dns_rules.enabled_categories} to signal that the
     * child's {@code daily_budget_minutes} limit is exhausted.  Same key used by
     * {@link BudgetEnforcementService#BUDGET_EXHAUSTED_KEY} so both mechanisms share the
     * same AdGuard sync path.
     */
    public static final String BUDGET_BLOCKED_KEY = BudgetEnforcementService.BUDGET_EXHAUSTED_KEY;

    /** Redis key prefix for date-stamped daily usage counters. */
    private static final String USAGE_PREFIX = "shield:budget:";

    /**
     * Suffix for the "last activity" marker key.
     * Set to expire after 2 minutes — if still present, the profile is "online now".
     */
    private static final String LAST_SEEN_SUFFIX = ":last_seen";

    private static final Duration LAST_SEEN_TTL = Duration.ofMinutes(2);
    private static final Duration USAGE_TTL = Duration.ofDays(2);

    private final DnsRulesRepository rulesRepo;
    private final StringRedisTemplate redis;
    private final AdGuardClient adGuard;

    // ──────────────────────────────────────────────────────────────────────────
    //  Public API — called by DNS query logging
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Record that {@code profileId} just made a DNS query.
     * Stamps a short-lived Redis key used by the scheduler to detect active profiles.
     *
     * @param profileId the child profile that generated the DNS query
     */
    public void recordActivity(UUID profileId) {
        String lastSeenKey = lastSeenKey(profileId);
        redis.opsForValue().set(lastSeenKey, "1", LAST_SEEN_TTL);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Scheduled enforcement — every 60 seconds
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Every minute: for each profile with a configured {@code daily_budget_minutes},
     * check whether the profile has been recently active (DNS query in the last 2 minutes)
     * and increment its daily usage counter if so.  Enforce the budget cutoff.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void enforceBudgets() {
        List<DnsRules> allRules = rulesRepo.findAllWithDailyBudget();
        int checked = 0;

        for (DnsRules rules : allRules) {
            Integer limitMinutes = rules.getDailyBudgetMinutes();

            UUID profileId = rules.getProfileId();
            checked++;

            // Check if the profile was recently active (last-seen TTL key still alive)
            boolean recentlyActive = Boolean.TRUE.equals(redis.hasKey(lastSeenKey(profileId)));

            // Increment daily usage counter only when the child is actively online
            String usageKey = usageKey(profileId);
            long usedMinutes;
            if (recentlyActive) {
                Long incremented = redis.opsForValue().increment(usageKey);
                usedMinutes = (incremented != null) ? incremented : 0L;
                // On first increment, set 2-day TTL for automatic cleanup
                if (usedMinutes == 1L) {
                    redis.expire(usageKey, USAGE_TTL);
                }
            } else {
                // Not active this minute — read current value without incrementing
                String val = redis.opsForValue().get(usageKey);
                usedMinutes = (val != null) ? Long.parseLong(val) : 0L;
            }

            // Determine whether the budget is exhausted
            boolean nowExhausted = usedMinutes >= limitMinutes;

            Map<String, Boolean> cats = rules.getEnabledCategories();
            if (cats == null) cats = new LinkedHashMap<>();
            Boolean current = cats.get(BUDGET_BLOCKED_KEY);

            if (!Objects.equals(current, nowExhausted)) {
                // State changed — persist flag and sync to AdGuard
                cats = new LinkedHashMap<>(cats);
                cats.put(BUDGET_BLOCKED_KEY, nowExhausted);
                rules.setEnabledCategories(cats);
                rulesRepo.save(rules);

                syncToAdGuard(rules, nowExhausted);

                if (nowExhausted) {
                    log.info("Budget EXHAUSTED (daily_budget_minutes): profileId={} used={}min limit={}min",
                            profileId, usedMinutes, limitMinutes);
                } else {
                    log.info("Budget RESTORED (daily_budget_minutes): profileId={} used={}min limit={}min",
                            profileId, usedMinutes, limitMinutes);
                }
            }
        }

        if (checked > 0) {
            log.debug("BudgetTrackingService tick: checked {} profiles with daily_budget_minutes", checked);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Public query helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Returns the number of minutes the profile has been online today according to
     * the date-stamped Redis counter.
     *
     * @param profileId child profile UUID
     * @return minutes online today (0 if no counter exists yet)
     */
    public int getUsedMinutesToday(UUID profileId) {
        String val = redis.opsForValue().get(usageKey(profileId));
        return (val != null) ? Integer.parseInt(val) : 0;
    }

    /**
     * Clears today's usage counter and the exhausted flag for a profile.
     * Used when the parent resets the budget mid-day.
     */
    @Transactional
    public void resetTodayUsage(UUID profileId) {
        redis.delete(usageKey(profileId));
        redis.delete(lastSeenKey(profileId));

        rulesRepo.findByProfileId(profileId).ifPresent(rules -> {
            Map<String, Boolean> cats = rules.getEnabledCategories();
            if (cats != null && Boolean.TRUE.equals(cats.get(BUDGET_BLOCKED_KEY))) {
                cats = new LinkedHashMap<>(cats);
                cats.put(BUDGET_BLOCKED_KEY, false);
                rules.setEnabledCategories(cats);
                rulesRepo.save(rules);
                syncToAdGuard(rules, false);
                log.info("Budget reset (daily_budget_minutes): profileId={} flag cleared", profileId);
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Redis key for the per-profile, date-stamped daily usage counter. */
    private String usageKey(UUID profileId) {
        return USAGE_PREFIX + profileId + ":" + LocalDate.now();
    }

    /** Redis key for the short-lived activity marker (2-minute TTL). */
    private String lastSeenKey(UUID profileId) {
        return USAGE_PREFIX + profileId + LAST_SEEN_SUFFIX;
    }

    /**
     * Notify AdGuard of budget enforcement state change (best-effort).
     * When {@code blocked} is true all DNS filtering is disabled (internet cut off).
     * When false, normal filtering is restored.
     */
    private void syncToAdGuard(DnsRules rules, boolean blocked) {
        String clientId = rules.getDnsClientId();
        if (clientId == null || clientId.isBlank()) return;
        try {
            if (blocked) {
                adGuard.updateClient(clientId, clientId, new AdGuardClient.AdGuardClientData(
                        false, false, false,
                        Map.of("enabled", false, "google", false, "bing", false,
                                "duckduckgo", false, "youtube", false),
                        List.of()
                ));
            } else {
                adGuard.updateClient(clientId, clientId, new AdGuardClient.AdGuardClientData(
                        true, true, true,
                        Map.of("enabled", true, "google", true, "bing", true,
                                "duckduckgo", true, "youtube",
                                Boolean.TRUE.equals(rules.getYoutubeRestricted())),
                        List.of()
                ));
            }
        } catch (Exception e) {
            log.warn("BudgetTrackingService AdGuard sync failed for profileId={}: {}",
                    rules.getProfileId(), e.getMessage());
        }
    }
}
