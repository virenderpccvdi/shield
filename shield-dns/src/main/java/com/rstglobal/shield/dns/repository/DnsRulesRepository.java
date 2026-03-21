package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.DnsRules;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

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
}
