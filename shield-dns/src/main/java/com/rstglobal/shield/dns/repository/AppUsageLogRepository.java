package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.AppUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUsageLogRepository extends JpaRepository<AppUsageLog, UUID> {
    Optional<AppUsageLog> findByProfileIdAndDomainPatternAndUsageDate(UUID profileId, String domainPattern, LocalDate date);
    List<AppUsageLog> findByProfileIdAndUsageDate(UUID profileId, LocalDate date);
    List<AppUsageLog> findByProfileIdAndUsageDateBetweenOrderByUsageDateDesc(UUID profileId, LocalDate from, LocalDate to);
    List<AppUsageLog> findByBudgetDepletedTrueAndUsageDate(LocalDate date);
}
