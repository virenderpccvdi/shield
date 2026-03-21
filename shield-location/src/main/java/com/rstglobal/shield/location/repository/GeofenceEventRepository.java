package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.GeofenceEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GeofenceEventRepository extends JpaRepository<GeofenceEvent, UUID> {

    List<GeofenceEvent> findTop100ByProfileIdOrderByOccurredAtDesc(UUID profileId);

    List<GeofenceEvent> findTop100ByGeofenceIdOrderByOccurredAtDesc(UUID geofenceId);
}
