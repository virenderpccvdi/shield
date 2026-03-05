package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ScheduleRepository extends JpaRepository<Schedule, UUID> {
    Optional<Schedule> findByProfileId(UUID profileId);
    boolean existsByProfileId(UUID profileId);
}
