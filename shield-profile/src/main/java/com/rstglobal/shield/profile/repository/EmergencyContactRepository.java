package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, UUID> {
    List<EmergencyContact> findByProfileIdOrderByCreatedAtAsc(UUID profileId);
    long countByProfileId(UUID profileId);
}
