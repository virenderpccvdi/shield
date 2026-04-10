package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.SchedulePreset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SchedulePresetRepository extends JpaRepository<SchedulePreset, UUID> {
    Optional<SchedulePreset> findByName(String name);
    List<SchedulePreset> findAllByOrderByName();
}
