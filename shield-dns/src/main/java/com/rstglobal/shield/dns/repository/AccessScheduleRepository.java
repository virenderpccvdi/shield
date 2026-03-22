package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.AccessSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * PO-06 — Repository for per-profile access schedule rules.
 */
public interface AccessScheduleRepository extends JpaRepository<AccessSchedule, UUID> {

    /** All schedules for a given child profile (active or inactive). */
    List<AccessSchedule> findByProfileId(UUID profileId);

    /**
     * All active schedules that have {@code blockOutside = true}.
     * Used by the enforcement scheduler to find rules that need to be evaluated
     * each minute without loading every row in the table.
     */
    List<AccessSchedule> findByIsActiveTrueAndBlockOutsideTrue();
}
