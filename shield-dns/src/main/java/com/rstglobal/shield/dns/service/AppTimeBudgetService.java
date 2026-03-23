package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.entity.AppTimeBudget;
import com.rstglobal.shield.dns.entity.AppUsageLog;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.AppTimeBudgetRepository;
import com.rstglobal.shield.dns.repository.AppUsageLogRepository;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * PC-03 — Per-App Time Budgets.
 *
 * Parents configure a daily minute allowance per app (identified by domain pattern).
 * The Flutter child app periodically reports app usage via {@link #reportUsage}.
 * When the budget is consumed the domain is added to the profile's custom blocklist,
 * AdGuard is synced, and the parent is notified.
 * At midnight a scheduled job unblocks the domain and resets the day.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppTimeBudgetService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final AppTimeBudgetRepository budgetRepo;
    private final AppUsageLogRepository usageRepo;
    private final DnsRulesRepository rulesRepo;
    private final DnsRulesService dnsRulesService;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient = RestClient.builder().build();

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> upsertBudget(UUID profileId, String appName, String domainPattern, int dailyMinutes) {
        AppTimeBudget budget = budgetRepo.findByProfileIdAndDomainPattern(profileId, domainPattern)
                .orElse(AppTimeBudget.builder().profileId(profileId).build());
        budget.setAppName(appName);
        budget.setDomainPattern(domainPattern);
        budget.setDailyMinutes(dailyMinutes);
        budget.setUpdatedAt(OffsetDateTime.now());
        budget = budgetRepo.save(budget);
        return toMap(budget);
    }

    @Transactional
    public void deleteBudget(UUID profileId, UUID budgetId) {
        AppTimeBudget b = budgetRepo.findById(budgetId)
                .orElseThrow(() -> ShieldException.notFound("app-budget", budgetId.toString()));
        if (!b.getProfileId().equals(profileId)) {
            throw ShieldException.forbidden("Not your budget");
        }
        budgetRepo.delete(b);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBudgets(UUID profileId) {
        List<AppTimeBudget> budgets = budgetRepo.findByProfileId(profileId);
        List<AppUsageLog> todayUsage = usageRepo.findByProfileIdAndUsageDate(profileId, LocalDate.now());

        Map<String, Integer> usageMap = new HashMap<>();
        for (AppUsageLog u : todayUsage) {
            usageMap.put(u.getDomainPattern(), u.getUsedMinutes());
        }

        return budgets.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>(toMap(b));
            int used = usageMap.getOrDefault(b.getDomainPattern(), 0);
            m.put("usedMinutes", used);
            m.put("remainingMinutes", Math.max(0, b.getDailyMinutes() - used));
            m.put("depleted", used >= b.getDailyMinutes());
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUsageHistory(UUID profileId, LocalDate from, LocalDate to) {
        return usageRepo.findByProfileIdAndUsageDateBetweenOrderByUsageDateDesc(profileId, from, to)
                .stream()
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId().toString());
                    m.put("profileId", u.getProfileId().toString());
                    m.put("appName", u.getAppName());
                    m.put("domainPattern", u.getDomainPattern());
                    m.put("usageDate", u.getUsageDate().toString());
                    m.put("usedMinutes", u.getUsedMinutes());
                    m.put("budgetDepleted", u.isBudgetDepleted());
                    return m;
                }).toList();
    }

    // ── Usage reporting (called by Flutter child app) ─────────────────────────

    /**
     * Flutter child app reports app usage in minutes.
     * Called periodically (e.g. every 5 minutes) with the number of minutes used since last report.
     */
    @Transactional
    public Map<String, Object> reportUsage(UUID profileId, String domainPattern, int additionalMinutes) {
        Optional<AppTimeBudget> budgetOpt = budgetRepo.findByProfileIdAndDomainPattern(profileId, domainPattern);
        if (budgetOpt.isEmpty()) {
            return Map.of("tracked", false, "message", "No budget configured for " + domainPattern);
        }
        AppTimeBudget budget = budgetOpt.get();

        // Upsert today's usage log
        AppUsageLog usage = usageRepo
                .findByProfileIdAndDomainPatternAndUsageDate(profileId, domainPattern, LocalDate.now())
                .orElse(AppUsageLog.builder()
                        .profileId(profileId)
                        .appName(budget.getAppName())
                        .domainPattern(domainPattern)
                        .usageDate(LocalDate.now())
                        .build());

        boolean wasAlreadyDepleted = usage.isBudgetDepleted();
        usage.setUsedMinutes(usage.getUsedMinutes() + additionalMinutes);
        usage.setUpdatedAt(OffsetDateTime.now());

        boolean nowDepleted = usage.getUsedMinutes() >= budget.getDailyMinutes();
        usage.setBudgetDepleted(nowDepleted);
        usageRepo.save(usage);

        // If newly depleted, block the domain and notify parent
        if (nowDepleted && !wasAlreadyDepleted) {
            blockDomain(profileId, domainPattern, budget.getAppName());
            notifyParent(profileId, budget);
        }

        return Map.of(
                "tracked", true,
                "appName", budget.getAppName(),
                "usedMinutes", usage.getUsedMinutes(),
                "dailyMinutes", budget.getDailyMinutes(),
                "depleted", nowDepleted
        );
    }

    /**
     * Bulk-sync today's absolute usage from the Flutter child app (via UsageStatsManager).
     * Accepts a list of {packageName → minutesUsedToday} and sets (not increments) the
     * usage log for any budget whose domainPattern equals the package name.
     * Triggers budget depletion logic when thresholds are crossed.
     */
    @Transactional
    public Map<String, Object> syncUsage(UUID profileId, List<Map<String, Object>> usageList) {
        int tracked = 0;
        int depleted = 0;
        for (Map<String, Object> entry : usageList) {
            String packageName = (String) entry.get("packageName");
            Object minutesObj = entry.get("minutesUsed");
            if (packageName == null || minutesObj == null) continue;
            int minutesUsed = ((Number) minutesObj).intValue();
            if (minutesUsed < 0) continue;

            Optional<AppTimeBudget> budgetOpt = budgetRepo.findByProfileIdAndDomainPattern(profileId, packageName);
            if (budgetOpt.isEmpty()) continue;
            AppTimeBudget budget = budgetOpt.get();

            AppUsageLog usage = usageRepo
                    .findByProfileIdAndDomainPatternAndUsageDate(profileId, packageName, LocalDate.now())
                    .orElse(AppUsageLog.builder()
                            .profileId(profileId)
                            .appName(budget.getAppName())
                            .domainPattern(packageName)
                            .usageDate(LocalDate.now())
                            .build());

            boolean wasAlreadyDepleted = usage.isBudgetDepleted();
            // Set absolute minutes (overwrite, not increment)
            usage.setUsedMinutes(minutesUsed);
            boolean nowDepleted = minutesUsed >= budget.getDailyMinutes();
            usage.setBudgetDepleted(nowDepleted);
            usage.setUpdatedAt(OffsetDateTime.now());
            usageRepo.save(usage);

            if (nowDepleted && !wasAlreadyDepleted) {
                blockDomain(profileId, packageName, budget.getAppName());
                notifyParent(profileId, budget);
                depleted++;
            }
            tracked++;
        }
        return Map.of("tracked", tracked, "newlyDepleted", depleted);
    }

    // ── Daily reset at midnight ────────────────────────────────────────────────

    /**
     * At midnight, unblock domains that were blocked due to budget depletion yesterday.
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void dailyReset() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        List<AppUsageLog> depleted = usageRepo.findByBudgetDepletedTrueAndUsageDate(yesterday);

        for (AppUsageLog u : depleted) {
            try {
                unblockDomain(u.getProfileId(), u.getDomainPattern(), u.getAppName());
            } catch (Exception e) {
                log.warn("PC-03 daily reset — failed to unblock domain '{}' for profile={}: {}",
                        u.getDomainPattern(), u.getProfileId(), e.getMessage());
            }
        }
        log.info("PC-03 daily reset complete. Unblocked {} app-budget domains.", depleted.size());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void blockDomain(UUID profileId, String domain, String appName) {
        try {
            DnsRules rules = rulesRepo.findByProfileId(profileId).orElse(null);
            if (rules == null) return;
            List<String> blocklist = new ArrayList<>(
                    Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
            String marker = domain + " # pc03-budget";
            if (blocklist.stream().noneMatch(d -> d.startsWith(domain))) {
                blocklist.add(marker);
                rules.setCustomBlocklist(blocklist);
                rulesRepo.save(rules);
                dnsRulesService.syncRules(profileId);
                log.info("PC-03: budget depleted — blocked domain '{}' for profile={}", domain, profileId);
            }
        } catch (Exception e) {
            log.warn("PC-03: failed to block domain '{}' for profile={}: {}", domain, profileId, e.getMessage());
        }
    }

    private void unblockDomain(UUID profileId, String domain, String appName) {
        try {
            DnsRules rules = rulesRepo.findByProfileId(profileId).orElse(null);
            if (rules == null) return;
            List<String> blocklist = new ArrayList<>(
                    Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
            boolean removed = blocklist.removeIf(
                    d -> d.equals(domain + " # pc03-budget") || d.equals(domain));
            if (removed) {
                rules.setCustomBlocklist(blocklist);
                rulesRepo.save(rules);
                dnsRulesService.syncRules(profileId);
                log.info("PC-03: daily reset — unblocked domain '{}' for profile={}", domain, profileId);
            }
        } catch (Exception e) {
            log.warn("PC-03: failed to unblock domain '{}' for profile={}: {}", domain, profileId, e.getMessage());
        }
    }

    private void notifyParent(UUID profileId, AppTimeBudget budget) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
            if (instances.isEmpty()) {
                log.warn("PC-03: No SHIELD-NOTIFICATION instances in Eureka — skipping budget depletion notification");
                return;
            }
            String base = instances.get(0).getUri().toString();

            // Resolve tenantId from DnsRules for the notification tenant routing
            String tenantIdStr = rulesRepo.findByProfileId(profileId)
                    .map(r -> r.getTenantId() != null ? r.getTenantId().toString() : "00000000-0000-0000-0000-000000000000")
                    .orElse("00000000-0000-0000-0000-000000000000");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", "APP_BUDGET_DEPLETED");
            payload.put("title", "App time limit reached: " + budget.getAppName());
            payload.put("body", budget.getAppName() + " has used its daily allowance of "
                    + budget.getDailyMinutes() + " minutes. Access is now blocked until midnight.");
            payload.put("userId", profileId.toString());
            payload.put("profileId", profileId.toString());
            payload.put("tenantId", tenantIdStr);
            payload.put("appName", budget.getAppName());
            payload.put("domain", budget.getDomainPattern());
            payload.put("dailyMinutes", budget.getDailyMinutes());
            payload.put("actionUrl", "https://shield.rstglobal.in/app/app-budgets");

            restClient.post()
                    .uri(base + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("PC-03: budget depletion notification sent for profile={} app='{}'",
                    profileId, budget.getAppName());
        } catch (Exception e) {
            log.warn("PC-03: budget depletion notification failed for profile={}: {}", profileId, e.getMessage());
        }
    }

    private Map<String, Object> toMap(AppTimeBudget b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId() != null ? b.getId().toString() : null);
        m.put("profileId", b.getProfileId().toString());
        m.put("appName", b.getAppName());
        m.put("domainPattern", b.getDomainPattern());
        m.put("dailyMinutes", b.getDailyMinutes());
        return m;
    }
}
