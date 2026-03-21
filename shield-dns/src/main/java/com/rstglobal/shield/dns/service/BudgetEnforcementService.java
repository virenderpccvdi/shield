package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.dns.client.AdGuardClient;
import com.rstglobal.shield.dns.entity.BudgetUsage;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.BudgetUsageRepository;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Scheduled service that enforces time budgets for child profiles.
 * <p>
 * Every minute it increments Redis usage counters for profiles that have active budgets.
 * When usage hits 80% or 100% of a budget limit, a notification is sent to the parent.
 * When the "total" daily budget key is exhausted, all internet is cut off by setting
 * the {@code __budget_exhausted__} flag in dns_rules.enabled_categories and syncing to AdGuard.
 * At midnight, all daily counters are reset and persisted to the database.
 */
@Slf4j
@Service
public class BudgetEnforcementService {

    /**
     * Special key stored in dns_rules.enabled_categories to signal that the child's total
     * daily screen-time budget is exhausted.  Checked by DnsRulesService.syncToAdGuard()
     * alongside {@code __schedule_blocked__} to disable all DNS filtering.
     */
    public static final String BUDGET_EXHAUSTED_KEY = "__budget_exhausted__";

    /**
     * Key used inside the timeBudgets map to represent the TOTAL daily internet budget
     * (as opposed to per-category limits).  Value is in minutes; 0 = no total limit.
     */
    public static final String TOTAL_BUDGET_KEY = "total";

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String REDIS_PREFIX = "shield:budget:";
    /** Suffix appended to the budget key when 80% warning has been sent */
    private static final String WARNED_80_SUFFIX = ":warned80";
    /** Suffix appended to the budget key when 100% exceeded notification has been sent */
    private static final String WARNED_100_SUFFIX = ":warned100";

    private final DnsRulesRepository rulesRepo;
    private final BudgetUsageRepository usageRepo;
    private final StringRedisTemplate redis;
    private final DiscoveryClient discoveryClient;
    private final AdGuardClient adGuard;
    private final RestClient restClient;

    public BudgetEnforcementService(DnsRulesRepository rulesRepo,
                                    BudgetUsageRepository usageRepo,
                                    StringRedisTemplate redis,
                                    DiscoveryClient discoveryClient,
                                    AdGuardClient adGuard) {
        this.rulesRepo = rulesRepo;
        this.usageRepo = usageRepo;
        this.redis = redis;
        this.discoveryClient = discoveryClient;
        this.adGuard = adGuard;
        this.restClient = RestClient.builder().build();
    }

    // -------------------------------------------------------
    //  Every-minute check: increment usage + enforce limits
    // -------------------------------------------------------

    @Scheduled(fixedRate = 60_000)
    public void enforceTimeBudgets() {
        List<DnsRules> allRules = rulesRepo.findAll();
        int checked = 0;

        for (DnsRules rules : allRules) {
            Map<String, Integer> budgets = rules.getTimeBudgets();
            if (budgets == null || budgets.isEmpty()) {
                continue;
            }

            UUID profileId = rules.getProfileId();
            checked++;

            for (Map.Entry<String, Integer> entry : budgets.entrySet()) {
                String category = entry.getKey();
                int limitMinutes = entry.getValue();
                if (limitMinutes <= 0) {
                    continue; // 0 means unlimited
                }
                // The "total" key is handled separately below — skip it here
                if (TOTAL_BUDGET_KEY.equals(category)) {
                    continue;
                }

                // Increment by 1 minute (assumes the child is actively using the category)
                String usageKey = usageKey(profileId, category);
                Long usedMinutes = redis.opsForValue().increment(usageKey);
                if (usedMinutes == null) usedMinutes = 0L;

                // Set TTL to expire at end of day (auto-cleanup if midnight reset is missed)
                if (usedMinutes == 1) {
                    redis.expire(usageKey, Duration.ofHours(25));
                }

                // 80% warning
                if (usedMinutes >= (long) (limitMinutes * 0.8) && usedMinutes < limitMinutes) {
                    String warned80Key = usageKey + WARNED_80_SUFFIX;
                    Boolean alreadyWarned = redis.hasKey(warned80Key);
                    if (!Boolean.TRUE.equals(alreadyWarned)) {
                        redis.opsForValue().set(warned80Key, "1", Duration.ofHours(25));
                        sendBudgetNotification(profileId, rules.getTenantId(), category,
                                usedMinutes.intValue(), limitMinutes, false);
                    }
                }

                // 100% exceeded
                if (usedMinutes >= limitMinutes) {
                    String warned100Key = usageKey + WARNED_100_SUFFIX;
                    Boolean alreadyWarned = redis.hasKey(warned100Key);
                    if (!Boolean.TRUE.equals(alreadyWarned)) {
                        redis.opsForValue().set(warned100Key, "1", Duration.ofHours(25));
                        sendBudgetNotification(profileId, rules.getTenantId(), category,
                                usedMinutes.intValue(), limitMinutes, true);
                        // Block the category by disabling it in DNS rules
                        blockCategory(rules, category);
                    }
                }
            }

            // ── Total daily budget enforcement ────────────────────────────────────
            // If timeBudgets contains a "total" key, treat it as the overall daily
            // internet allowance.  Every minute a profile has ANY budget, we increment
            // its total counter.  When it hits the limit, we set __budget_exhausted__
            // in enabled_categories and push the change to AdGuard so ALL DNS is cut off.
            Integer totalLimitMinutes = budgets.get(TOTAL_BUDGET_KEY);
            if (totalLimitMinutes != null && totalLimitMinutes > 0) {
                String totalKey = totalUsageKey(profileId);
                Long totalUsed = redis.opsForValue().increment(totalKey);
                if (totalUsed == null) totalUsed = 0L;

                if (totalUsed == 1) {
                    redis.expire(totalKey, Duration.ofHours(25));
                }

                Map<String, Boolean> cats = rules.getEnabledCategories();
                if (cats == null) cats = new LinkedHashMap<>();
                boolean wasExhausted = Boolean.TRUE.equals(cats.get(BUDGET_EXHAUSTED_KEY));
                boolean nowExhausted = totalUsed >= totalLimitMinutes;

                // 80% warning for total budget
                if (totalUsed >= (long) (totalLimitMinutes * 0.8) && totalUsed < totalLimitMinutes) {
                    String warned80Key = totalKey + WARNED_80_SUFFIX;
                    if (!Boolean.TRUE.equals(redis.hasKey(warned80Key))) {
                        redis.opsForValue().set(warned80Key, "1", Duration.ofHours(25));
                        sendBudgetNotification(profileId, rules.getTenantId(), "total",
                                totalUsed.intValue(), totalLimitMinutes, false);
                    }
                }

                if (nowExhausted != wasExhausted) {
                    // State changed — update DnsRules flag and sync to AdGuard
                    cats = new LinkedHashMap<>(cats);
                    cats.put(BUDGET_EXHAUSTED_KEY, nowExhausted);
                    rules.setEnabledCategories(cats);
                    rulesRepo.save(rules);

                    if (nowExhausted) {
                        // First time exhausted — send notification
                        String warned100Key = totalKey + WARNED_100_SUFFIX;
                        if (!Boolean.TRUE.equals(redis.hasKey(warned100Key))) {
                            redis.opsForValue().set(warned100Key, "1", Duration.ofHours(25));
                            sendBudgetNotification(profileId, rules.getTenantId(), "total",
                                    totalUsed.intValue(), totalLimitMinutes, true);
                        }
                        // Cut off internet via AdGuard
                        syncBudgetExhaustedToAdGuard(rules, true);
                        log.info("Budget EXHAUSTED: profileId={} usedMin={} totalLimit={}",
                                profileId, totalUsed, totalLimitMinutes);
                    } else {
                        // Budget was restored (parent extended the limit mid-day)
                        syncBudgetExhaustedToAdGuard(rules, false);
                        log.info("Budget RESTORED: profileId={} usedMin={} totalLimit={}",
                                profileId, totalUsed, totalLimitMinutes);
                    }
                }
            }
        }

        if (checked > 0) {
            log.debug("Budget enforcement tick: checked {} profiles with budgets", checked);
        }
    }

    // -------------------------------------------------------
    //  Midnight reset: persist to DB, clear Redis counters
    // -------------------------------------------------------

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void midnightReset() {
        log.info("Midnight budget reset started");
        LocalDate yesterday = LocalDate.now().minusDays(1);
        List<DnsRules> allRules = rulesRepo.findAll();
        int persisted = 0;

        for (DnsRules rules : allRules) {
            Map<String, Integer> budgets = rules.getTimeBudgets();
            if (budgets == null || budgets.isEmpty()) continue;

            UUID profileId = rules.getProfileId();
            Map<String, Integer> appUsage = new LinkedHashMap<>();

            for (String category : budgets.keySet()) {
                if (TOTAL_BUDGET_KEY.equals(category)) continue; // handled separately below
                String usageKey = usageKey(profileId, category);
                String val = redis.opsForValue().get(usageKey);
                int used = (val != null) ? Integer.parseInt(val) : 0;
                if (used > 0) {
                    appUsage.put(category, used);
                }

                // Delete Redis keys for this category
                redis.delete(usageKey);
                redis.delete(usageKey + WARNED_80_SUFFIX);
                redis.delete(usageKey + WARNED_100_SUFFIX);
            }

            // Persist total usage to DB and clear total Redis keys
            String totalKey = totalUsageKey(profileId);
            String totalVal = redis.opsForValue().get(totalKey);
            int totalUsed = (totalVal != null) ? Integer.parseInt(totalVal) : 0;
            if (totalUsed > 0) {
                appUsage.put(TOTAL_BUDGET_KEY, totalUsed);
            }
            redis.delete(totalKey);
            redis.delete(totalKey + WARNED_80_SUFFIX);
            redis.delete(totalKey + WARNED_100_SUFFIX);

            if (!appUsage.isEmpty()) {
                // Persist yesterday's usage to DB
                BudgetUsage usage = usageRepo.findByProfileIdAndDate(profileId, yesterday)
                        .orElse(BudgetUsage.builder()
                                .profileId(profileId)
                                .date(yesterday)
                                .build());
                usage.setAppUsage(appUsage);
                usageRepo.save(usage);
                persisted++;
            }

            // Re-enable any categories that were blocked due to budget exceeded.
            // Also clear the __budget_exhausted__ flag so the new day starts with internet access.
            unblockBudgetCategories(rules);
        }

        log.info("Midnight budget reset complete: persisted {} usage records", persisted);
    }

    // -------------------------------------------------------
    //  Helper methods
    // -------------------------------------------------------

    /**
     * Block a category by setting it to false in enabledCategories.
     */
    @Transactional
    public void blockCategory(DnsRules rules, String category) {
        Map<String, Boolean> categories = rules.getEnabledCategories();
        if (categories == null) {
            categories = new LinkedHashMap<>();
        } else {
            categories = new LinkedHashMap<>(categories);
        }
        categories.put(category, false);
        rules.setEnabledCategories(categories);
        rulesRepo.save(rules);
        log.info("Blocked category '{}' for profile {} due to budget exceeded", category, rules.getProfileId());
    }

    /**
     * Re-enable categories and clear budget flags at daily midnight reset.
     * <ul>
     *   <li>Re-enables per-category blocks that were set by budget enforcement.</li>
     *   <li>Clears {@code __budget_exhausted__} so the new day starts with internet access.</li>
     *   <li>Syncs to AdGuard when the exhausted flag was previously set.</li>
     * </ul>
     */
    @Transactional
    public void unblockBudgetCategories(DnsRules rules) {
        Map<String, Boolean> categories = rules.getEnabledCategories();
        Map<String, Integer> budgets = rules.getTimeBudgets();
        if (categories == null || budgets == null) return;

        boolean changed = false;
        Map<String, Boolean> updated = new LinkedHashMap<>(categories);

        // Re-enable per-category blocks
        for (String category : budgets.keySet()) {
            if (Boolean.FALSE.equals(updated.get(category))) {
                updated.put(category, true);
                changed = true;
            }
        }

        // Clear __budget_exhausted__ flag so a new day starts fresh
        boolean wasExhausted = Boolean.TRUE.equals(updated.get(BUDGET_EXHAUSTED_KEY));
        if (wasExhausted) {
            updated.put(BUDGET_EXHAUSTED_KEY, false);
            changed = true;
        }

        if (changed) {
            rules.setEnabledCategories(updated);
            rulesRepo.save(rules);
            log.info("Daily reset: re-enabled budget-blocked categories for profile {} (wasExhausted={})",
                    rules.getProfileId(), wasExhausted);
            if (wasExhausted) {
                // Restore internet access via AdGuard
                syncBudgetExhaustedToAdGuard(rules, false);
            }
        }
    }

    /**
     * Notify AdGuard of budget-exhausted state change (best-effort).
     * When {@code exhausted} is true, all DNS filtering is disabled (= internet blocked).
     * When false, normal filtering is restored.
     */
    private void syncBudgetExhaustedToAdGuard(DnsRules rules, boolean exhausted) {
        String clientId = rules.getDnsClientId();
        if (clientId == null || clientId.isBlank()) return;
        try {
            if (exhausted) {
                adGuard.updateClient(clientId, clientId, new AdGuardClient.AdGuardClientData(
                        false, false, false,
                        Map.of("enabled", false, "google", false, "bing", false,
                                "duckduckgo", false, "youtube", false),
                        List.of()
                ));
            } else {
                // Restore normal filtering with safe defaults
                adGuard.updateClient(clientId, clientId, new AdGuardClient.AdGuardClientData(
                        true, true, true,
                        Map.of("enabled", true, "google", true, "bing", true,
                                "duckduckgo", true, "youtube",
                                Boolean.TRUE.equals(rules.getYoutubeRestricted())),
                        List.of()
                ));
            }
            log.info("Budget AdGuard sync: profileId={} clientId={} exhausted={}",
                    rules.getProfileId(), clientId, exhausted);
        } catch (Exception e) {
            log.warn("Budget AdGuard sync failed for profileId={}: {}", rules.getProfileId(), e.getMessage());
        }
    }

    private void sendBudgetNotification(UUID profileId, UUID tenantId,
                                         String category, int usedMinutes, int limitMinutes,
                                         boolean exceeded) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            String title = exceeded
                    ? "Time Budget Exceeded: " + category
                    : "Time Budget Warning: " + category;
            String body = exceeded
                    ? "Screen time for \"" + category + "\" has reached the daily limit of "
                      + limitMinutes + " minutes. Access has been blocked for today."
                    : "Screen time for \"" + category + "\" has reached " + usedMinutes
                      + " of " + limitMinutes + " minutes (80%). Consider wrapping up.";

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "TIME_BUDGET");
            payload.put("title", title);
            payload.put("body", body);
            payload.put("userId", profileId.toString());
            payload.put("profileId", profileId.toString());
            payload.put("tenantId", tenantId != null ? tenantId.toString() : "00000000-0000-0000-0000-000000000000");
            payload.put("actionUrl", "https://shield.rstglobal.in/app/screen-time");

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Budget {} notification sent: profile={} category={} used={}/{}min",
                    exceeded ? "exceeded" : "warning", profileId, category, usedMinutes, limitMinutes);
        } catch (Exception e) {
            log.warn("Failed to send budget notification for profile={}: {}", profileId, e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} in Eureka — skipping budget notification", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private String usageKey(UUID profileId, String category) {
        return REDIS_PREFIX + profileId + ":" + category + ":used";
    }

    /** Redis key for the per-profile total daily internet usage counter. */
    private String totalUsageKey(UUID profileId) {
        return REDIS_PREFIX + profileId + ":total:used";
    }
}
