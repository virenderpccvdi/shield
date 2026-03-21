package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScheduleRepository extends JpaRepository<Schedule, UUID> {
    Optional<Schedule> findByProfileId(UUID profileId);
    boolean existsByProfileId(UUID profileId);

    /**
     * Returns only schedules whose override timer has expired and needs to be cleared.
     * Used by ScheduleService.expireOverrides() to avoid loading the entire table.
     */
    @Query("SELECT s FROM Schedule s WHERE s.overrideActive = true AND s.overrideEndsAt IS NOT NULL AND s.overrideEndsAt < :now")
    List<Schedule> findExpiredOverrides(@Param("now") OffsetDateTime now);

    /**
     * Returns all schedules — used by enforceSchedules() which must check every profile.
     * Kept separate to make intent explicit; callers should not use findAll() directly.
     */
    @Query("SELECT s FROM Schedule s")
    List<Schedule> findAllSchedules();
}
