package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.BudgetUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface BudgetUsageRepository extends JpaRepository<BudgetUsage, UUID> {
    Optional<BudgetUsage> findByProfileIdAndDate(UUID profileId, LocalDate date);
}
