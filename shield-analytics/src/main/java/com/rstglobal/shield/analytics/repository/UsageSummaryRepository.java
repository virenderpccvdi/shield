package com.rstglobal.shield.analytics.repository;

import com.rstglobal.shield.analytics.entity.UsageSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UsageSummaryRepository extends JpaRepository<UsageSummary, UUID> {

    List<UsageSummary> findByProfileIdAndSummaryDateBetween(
            UUID profileId, LocalDate from, LocalDate to);

    Optional<UsageSummary> findByProfileIdAndSummaryDate(UUID profileId, LocalDate summaryDate);
}
