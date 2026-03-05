package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.CheckinRequest;
import com.rstglobal.shield.location.dto.request.LocationUploadRequest;
import com.rstglobal.shield.location.dto.response.LocationResponse;
import com.rstglobal.shield.location.entity.LocationPoint;
import com.rstglobal.shield.location.repository.GeofenceEventRepository;
import com.rstglobal.shield.location.repository.LocationPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationPointRepository locationPointRepository;
    private final GeofenceEventRepository geofenceEventRepository;
    private final GeofenceService geofenceService;
    private final GeofenceBreachDetector geofenceBreachDetector;

    @Transactional
    public LocationResponse uploadLocation(LocationUploadRequest req, UUID userId, String role) {
        LocationPoint point = LocationPoint.builder()
                .tenantId(null) // resolved from gateway headers if needed
                .profileId(req.getProfileId())
                .deviceId(req.getDeviceId())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .accuracy(req.getAccuracy())
                .altitude(req.getAltitude())
                .speed(req.getSpeed())
                .heading(req.getHeading())
                .batteryPct(req.getBatteryPct())
                .isMoving(req.getIsMoving() != null ? req.getIsMoving() : false)
                .recordedAt(req.getRecordedAt())
                .build();

        point = locationPointRepository.save(point);
        log.debug("Saved location point for profile {} at {},{}", req.getProfileId(), req.getLatitude(), req.getLongitude());

        checkGeofences(point);

        return toResponse(point);
    }

    @Transactional(readOnly = true)
    public LocationResponse getLatestLocation(UUID profileId) {
        return locationPointRepository.findFirstByProfileIdOrderByRecordedAtDesc(profileId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No location data found for profile: " + profileId));
    }

    @Transactional(readOnly = true)
    public Page<LocationResponse> getLocationHistory(UUID profileId, OffsetDateTime from, OffsetDateTime to, Pageable pageable) {
        return locationPointRepository.findByProfileIdAndRecordedAtBetweenOrderByRecordedAtDesc(
                profileId, from, to, pageable
        ).map(this::toResponse);
    }

    /**
     * Check if the newly uploaded location point triggers any geofence entry/exit events.
     * Delegates to {@link GeofenceBreachDetector} which uses Redis state tracking
     * for proper ENTER/EXIT transition detection and sends push notifications.
     */
    @Transactional
    public void checkGeofences(LocationPoint point) {
        geofenceBreachDetector.detect(point);
    }

    /**
     * Child manual check-in — saves a location point.
     */
    @Transactional
    public LocationResponse childCheckin(CheckinRequest req) {
        LocationPoint point = LocationPoint.builder()
                .profileId(req.getProfileId())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .speed(BigDecimal.ZERO)
                .isMoving(false)
                .recordedAt(OffsetDateTime.now())
                .build();
        point = locationPointRepository.save(point);
        log.info("Child check-in recorded for profile {} at {},{} message='{}'",
                req.getProfileId(), req.getLatitude(), req.getLongitude(), req.getMessage());
        checkGeofences(point);
        return toResponse(point);
    }

    /**
     * Estimates current speed from the two most recent location points.
     * Uses Haversine formula. Returns 0 if fewer than 2 points exist.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> estimateSpeed(UUID profileId) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime oneHourAgo = now.minusHours(1);
        Page<LocationPoint> recentPage = locationPointRepository
                .findByProfileIdAndRecordedAtBetweenOrderByRecordedAtDesc(
                        profileId, oneHourAgo, now,
                        org.springframework.data.domain.PageRequest.of(0, 2));
        List<LocationPoint> recent = recentPage.getContent();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("profileId", profileId);

        if (recent.size() < 2) {
            // If latest point has a speed value from device, use it
            if (!recent.isEmpty() && recent.getFirst().getSpeed() != null) {
                result.put("speedKmh", recent.getFirst().getSpeed().setScale(1, RoundingMode.HALF_UP));
            } else {
                result.put("speedKmh", BigDecimal.ZERO);
            }
            result.put("source", recent.isEmpty() ? "NO_DATA" : "DEVICE");
            return result;
        }

        LocationPoint p1 = recent.get(0); // newer
        LocationPoint p2 = recent.get(1); // older

        double distanceMeters = geofenceService.calculateDistanceMeters(
                p1.getLatitude().doubleValue(), p1.getLongitude().doubleValue(),
                p2.getLatitude().doubleValue(), p2.getLongitude().doubleValue());

        long timeDiffSeconds = java.time.Duration.between(p2.getRecordedAt(), p1.getRecordedAt()).getSeconds();
        double speedKmh = timeDiffSeconds > 0 ? (distanceMeters / timeDiffSeconds) * 3.6 : 0.0;

        result.put("speedKmh", BigDecimal.valueOf(speedKmh).setScale(1, RoundingMode.HALF_UP));
        result.put("source", "CALCULATED");
        result.put("distanceMeters", BigDecimal.valueOf(distanceMeters).setScale(1, RoundingMode.HALF_UP));
        result.put("timeDiffSeconds", timeDiffSeconds);
        return result;
    }

    private LocationResponse toResponse(LocationPoint p) {
        return LocationResponse.builder()
                .id(p.getId())
                .profileId(p.getProfileId())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .accuracy(p.getAccuracy())
                .speed(p.getSpeed())
                .heading(p.getHeading())
                .batteryPct(p.getBatteryPct())
                .isMoving(p.getIsMoving())
                .recordedAt(p.getRecordedAt())
                .build();
    }
}
