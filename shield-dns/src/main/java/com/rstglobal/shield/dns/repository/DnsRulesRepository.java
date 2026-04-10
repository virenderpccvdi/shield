package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.DnsRules;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DnsRulesRepository extends JpaRepository<DnsRules, UUID> {
    Optional<DnsRules> findByProfileId(UUID profileId);
    Optional<DnsRules> findByDnsClientId(String dnsClientId);
    boolean existsByProfileId(UUID profileId);

    /**
     * Returns only profiles that have at least one time budget configured.
     * Used by BudgetEnforcementService to avoid loading the entire table every minute.
     */
    @Query(value = "SELECT * FROM dns.dns_rules WHERE time_budgets IS NOT NULL AND time_budgets != '{}' AND time_budgets != 'null'",
           nativeQuery = true)
    List<DnsRules> findAllWithTimeBudgets();

    /**
     * Returns all profiles with homework mode active AND whose end time has passed.
     * Used by HomeworkModeExpiryJob to auto-expire sessions.
     */
    @Query("SELECT r FROM DnsRules r WHERE r.homeworkModeActive = TRUE AND r.homeworkModeEndsAt <= :now")
    List<DnsRules> findAllActiveHomeworkExpired(OffsetDateTime now);

    /**
     * Returns all profiles that have bedtime lock enabled (bedtimeEnabled = true).
     * Used by BedtimeLockService scheduler — avoids loading the entire table each minute.
     */
    @Query("SELECT r FROM DnsRules r WHERE r.bedtimeEnabled = TRUE")
    List<DnsRules> findAllWithBedtimeEnabled();

    /**
     * Returns only profiles with a configured daily_budget_minutes limit.
     * Used by BudgetTrackingService — avoids loading the entire table every minute.
     */
    @Query("SELECT r FROM DnsRules r WHERE r.dailyBudgetMinutes IS NOT NULL AND r.dailyBudgetMinutes > 0")
    List<DnsRules> findAllWithDailyBudget();

    /**
     * Returns profiles where __schedule_blocked__ flag is currently TRUE.
     * Used by ScheduleService to clear stale flags for profiles that no longer
     * have active scheduled blocks (e.g. their blocked hour has ended).
     */
    @Query(value = """
        SELECT * FROM dns.dns_rules
        WHERE enabled_categories IS NOT NULL
          AND (enabled_categories ->> '__schedule_blocked__')::boolean = TRUE
        """, nativeQuery = true)
    List<DnsRules> findAllWithScheduleBlocked();
}
