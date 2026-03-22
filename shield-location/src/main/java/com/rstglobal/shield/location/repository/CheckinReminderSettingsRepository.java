package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.CheckinReminderSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CheckinReminderSettingsRepository extends JpaRepository<CheckinReminderSettings, UUID> {

    Optional<CheckinReminderSettings> findByProfileId(UUID profileId);

    List<CheckinReminderSettings> findByEnabledTrue();
}
