package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.GeofenceRequest;
import com.rstglobal.shield.location.dto.response.GeofenceResponse;
import com.rstglobal.shield.location.entity.Geofence;
import com.rstglobal.shield.location.repository.GeofenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeofenceService {

    private final GeofenceRepository geofenceRepository;

    @Transactional
    public GeofenceResponse createGeofence(GeofenceRequest req, UUID profileId, UUID tenantId) {
        Geofence geofence = Geofence.builder()
                .tenantId(tenantId)
                .profileId(profileId)
                .name(req.getName())
                .description(req.getDescription())
                .centerLat(req.getCenterLat())
                .centerLng(req.getCenterLng())
                .radiusMeters(req.getRadiusMeters() != null ? req.getRadiusMeters() : BigDecimal.valueOf(100))
                .alertOnEnter(req.getAlertOnEnter() != null ? req.getAlertOnEnter() : true)
                .alertOnExit(req.getAlertOnExit() != null ? req.getAlertOnExit() : true)
                .build();

        geofence = geofenceRepository.save(geofence);
        log.info("Created geofence '{}' for profile {}", geofence.getName(), profileId);
        return toResponse(geofence);
    }

    @Transactional(readOnly = true)
    public List<GeofenceResponse> listGeofences(UUID profileId) {
        return geofenceRepository.findByProfileIdOrderByCreatedAtDesc(profileId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public GeofenceResponse updateGeofence(UUID id, GeofenceRequest req) {
        Geofence geofence = geofenceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Geofence not found: " + id));

        geofence.setName(req.getName());
        if (req.getDescription() != null) geofence.setDescription(req.getDescription());
        geofence.setCenterLat(req.getCenterLat());
        geofence.setCenterLng(req.getCenterLng());
        if (req.getRadiusMeters() != null) geofence.setRadiusMeters(req.getRadiusMeters());
        if (req.getAlertOnEnter() != null) geofence.setAlertOnEnter(req.getAlertOnEnter());
        if (req.getAlertOnExit() != null) geofence.setAlertOnExit(req.getAlertOnExit());

        geofence = geofenceRepository.save(geofence);
        return toResponse(geofence);
    }

    @Transactional
    public void deleteGeofence(UUID id) {
        Geofence geofence = geofenceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Geofence not found: " + id));
        geofenceRepository.delete(geofence);
        log.info("Deleted geofence {}", id);
    }

    /**
     * Haversine formula: calculate distance between two lat/lng points in meters.
     */
    public double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371000; // Earth radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    public List<Geofence> getActiveGeofences(UUID profileId) {
        return geofenceRepository.findByProfileIdAndIsActiveTrue(profileId);
    }

    private GeofenceResponse toResponse(Geofence g) {
        return GeofenceResponse.builder()
                .id(g.getId())
                .profileId(g.getProfileId())
                .name(g.getName())
                .description(g.getDescription())
                .centerLat(g.getCenterLat())
                .centerLng(g.getCenterLng())
                .radiusMeters(g.getRadiusMeters())
                .isActive(g.getIsActive())
                .alertOnEnter(g.getAlertOnEnter())
                .alertOnExit(g.getAlertOnExit())
                .build();
    }
}
