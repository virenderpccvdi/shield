package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.UpdateBudgetsRequest;
import com.rstglobal.shield.dns.dto.response.BudgetStatusResponse;
import com.rstglobal.shield.dns.dto.response.BudgetTodayResponse;
import com.rstglobal.shield.dns.entity.BudgetUsage;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.BudgetUsageRepository;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BudgetService {

    private final DnsRulesRepository rulesRepo;
    private final BudgetUsageRepository usageRepo;
    private final StringRedisTemplate redis;

    @Transactional(readOnly = true)
    public Map<String, Integer> getBudgets(UUID profileId) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        return Optional.ofNullable(rules.getTimeBudgets()).orElse(Map.of());
    }

    @Transactional
    public Map<String, Integer> updateBudgets(UUID profileId, UpdateBudgetsRequest req) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        rules.setTimeBudgets(req.getBudgets());
        rulesRepo.save(rules);
        return req.getBudgets();
    }

    @Transactional(readOnly = true)
    public BudgetTodayResponse getTodayUsage(UUID profileId) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        Map<String, Integer> budgets = Optional.ofNullable(rules.getTimeBudgets()).orElse(Map.of());

        LocalDate today = LocalDate.now();
        BudgetUsage usage = usageRepo.findByProfileIdAndDate(profileId, today)
                .orElse(BudgetUsage.builder().profileId(profileId).date(today).appUsage(Map.of()).build());

        Map<String, BudgetTodayResponse.AppUsage> appUsageMap = new LinkedHashMap<>();
        budgets.forEach((app, limit) -> {
            int used = Optional.ofNullable(usage.getAppUsage()).map(m -> m.getOrDefault(app, 0)).orElse(0);
            String status = limit == 0 ? "ACTIVE" : (used >= limit ? "EXCEEDED" : "ACTIVE");
            appUsageMap.put(app, BudgetTodayResponse.AppUsage.builder()
                    .limitMinutes(limit)
                    .usedMinutes(used)
                    .status(status)
                    .build());
        });

        return BudgetTodayResponse.builder()
                .profileId(profileId)
                .date(today)
                .usage(appUsageMap)
                .build();
    }

    @Transactional
    public void grantExtension(UUID profileId, String appName, int extraMins) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        Map<String, Integer> budgets = new LinkedHashMap<>(
                Optional.ofNullable(rules.getTimeBudgets()).orElse(new LinkedHashMap<>()));
        int current = budgets.getOrDefault(appName, 0);
        budgets.put(appName, current + extraMins);
        rules.setTimeBudgets(budgets);
        rulesRepo.save(rules);
        log.info("Granted {} extra minutes for {} on profileId={}", extraMins, appName, profileId);
    }

    /**
     * Returns real-time budget status for a child profile.
     * Reads the live Redis counter (updated every minute by BudgetEnforcementService)
     * and the exhausted flag from dns_rules.enabled_categories.
     *
     * @param profileId the child profile UUID
     * @return current budget status with used/remaining minutes and exhausted flag
     */
    @Transactional(readOnly = true)
    public BudgetStatusResponse getStatus(UUID profileId) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));

        Map<String, Integer> budgets = Optional.ofNullable(rules.getTimeBudgets()).orElse(Map.of());
        int totalLimit = budgets.getOrDefault(BudgetEnforcementService.TOTAL_BUDGET_KEY, 0);

        // Read live counter from Redis; fall back to 0 if key doesn't exist yet today
        String redisKey = "shield:budget:" + profileId + ":total:used";
        String redisVal = redis.opsForValue().get(redisKey);
        int usedMinutes = (redisVal != null) ? Integer.parseInt(redisVal) : 0;

        boolean exhausted = Boolean.TRUE.equals(
                Optional.ofNullable(rules.getEnabledCategories())
                        .map(c -> c.get(BudgetEnforcementService.BUDGET_EXHAUSTED_KEY))
                        .orElse(false));

        int remaining;
        if (totalLimit <= 0) {
            remaining = -1; // No limit configured
        } else {
            remaining = Math.max(0, totalLimit - usedMinutes);
        }

        return BudgetStatusResponse.builder()
                .profileId(profileId)
                .exhausted(exhausted)
                .usedMinutes(usedMinutes)
                .totalMinutes(totalLimit)
                .remainingMinutes(remaining)
                .build();
    }
}
