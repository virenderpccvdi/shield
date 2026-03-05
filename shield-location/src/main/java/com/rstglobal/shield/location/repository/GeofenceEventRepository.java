package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.GeofenceEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GeofenceEventRepository extends JpaRepository<GeofenceEvent, UUID> {

    List<GeofenceEvent> findByProfileIdOrderByOccurredAtDesc(UUID profileId);

    List<GeofenceEvent> findByGeofenceIdOrderByOccurredAtDesc(UUID geofenceId);
}
