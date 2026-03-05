package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.Geofence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GeofenceRepository extends JpaRepository<Geofence, UUID> {

    List<Geofence> findByProfileIdOrderByCreatedAtDesc(UUID profileId);

    List<Geofence> findByProfileIdAndIsActiveTrue(UUID profileId);
}
