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
}
