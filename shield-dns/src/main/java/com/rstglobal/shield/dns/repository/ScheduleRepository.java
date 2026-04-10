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

    /**
     * Returns only schedules that are relevant for the current enforcement tick:
     * - schedules that have an active override (must be checked), OR
     * - schedules whose grid has at least one blocked hour on the given day key
     *   (non-empty array in the JSONB object means a rule is configured).
     * This avoids loading the entire table on every minute tick.
     *
     * @param dayKey lowercase day name, e.g. "monday"
     */
    @Query(value = """
        SELECT s.* FROM dns.schedules s
        WHERE s.override_active = TRUE
           OR (s.grid IS NOT NULL
               AND s.grid -> :dayKey IS NOT NULL
               AND s.grid -> :dayKey != 'null'::jsonb
               AND jsonb_array_length(s.grid -> :dayKey) > 0
               AND (
                 SELECT count(*) FROM jsonb_array_elements_text(s.grid -> :dayKey) v WHERE v::int = 1
               ) > 0
           )
        """, nativeQuery = true)
    List<Schedule> findSchedulesActiveForDay(@Param("dayKey") String dayKey);
}
