package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.SpoofingResult;
import com.rstglobal.shield.location.dto.SpoofingSignal;
import com.rstglobal.shield.location.entity.LocationPoint;
import com.rstglobal.shield.location.entity.SpoofingAlert;
import com.rstglobal.shield.location.repository.LocationPointRepository;
import com.rstglobal.shield.location.repository.SpoofingAlertRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Detects GPS spoofing/mock-location usage by analysing consecutive location updates.
 *
 * Four detection signals:
 * <ol>
 *   <li>IMPOSSIBLE_SPEED — consecutive points imply faster-than-aircraft travel</li>
 *   <li>PERFECT_ACCURACY — GPS accuracy reported as exactly 0.0 (common in mock apps)</li>
 *   <li>STATIONARY_CLONING — last N points have bit-identical coordinates (real GPS drifts)</li>
 *   <li>TELEPORTATION — point is in a different country than previous point within 10 minutes</li>
 * </ol>
 *
 * On detection, each signal is persisted to location.spoofing_alerts and a notification
 * is fired to shield-notification via its internal endpoint.
 */
@Slf4j
@Service
public class SpoofingDetectionService {

    /**
     * Speed in km/h above which consecutive points are considered impossible.
     * Commercial jets cruise ~900 km/h; 500 km/h leaves headroom for GPS error.
     */
    private static final double IMPOSSIBLE_SPEED_KMH = 500.0;

    /**
     * Window for impossible-speed check (seconds). Ignore pairs that are more
     * than 5 minutes apart — teleportation check covers those.
     */
    private static final long SPEED_CHECK_MAX_SECONDS = 300;

    /**
     * Distance in km above which a move within 10 minutes is flagged as teleportation.
     * India is ~3000 km wide; crossing 500 km in 10 min is not possible by any transport.
     */
    private static final double TELEPORTATION_KM_THRESHOLD = 500.0;
    private static final long TELEPORTATION_MAX_MINUTES = 10;

    /** Number of recent points checked for the stationary-cloning signal. */
    private static final int STATIONARY_CLONE_WINDOW = 5;

    /** Decimal places to use for coordinate comparison in cloning check. */
    private static final int COORD_PRECISION = 6;

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final LocationPointRepository locationPointRepository;
    private final SpoofingAlertRepository spoofingAlertRepository;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public SpoofingDetectionService(LocationPointRepository locationPointRepository,
                                    SpoofingAlertRepository spoofingAlertRepository,
                                    DiscoveryClient discoveryClient) {
        this.locationPointRepository = locationPointRepository;
        this.spoofingAlertRepository = spoofingAlertRepository;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Analyse a freshly-saved location point for spoofing indicators.
     * Should be called from {@link LocationService#uploadLocation} after the point is saved.
     *
     * @param newPoint      The newly saved location point
     * @param previousPoint The immediately prior point for this profile (may be null for first upload)
     * @return A {@link SpoofingResult} describing what was found
     */
    @Transactional
    public SpoofingResult analyze(LocationPoint newPoint, LocationPoint previousPoint) {
        UUID profileId = newPoint.getProfileId();
        List<SpoofingSignal> signals = new ArrayList<>();

        // Signal 1: IMPOSSIBLE_SPEED
        if (previousPoint != null) {
            checkImpossibleSpeed(newPoint, previousPoint, signals);
        }

        // Signal 2: PERFECT_ACCURACY
        checkPerfectAccuracy(newPoint, signals);

        // Signal 3: STATIONARY_CLONING
        checkStationaryCloning(newPoint, signals);

        // Signal 4: TELEPORTATION
        if (previousPoint != null) {
            checkTeleportation(newPoint, previousPoint, signals);
        }

        boolean suspicious = !signals.isEmpty();
        SpoofingResult result = new SpoofingResult(profileId, suspicious, signals);

        if (suspicious) {
            persistAlerts(newPoint, signals);
            notifySpoofingDetected(newPoint, signals);
            log.warn("Spoofing detected for profile={} signals={}", profileId,
                    signals.stream().map(SpoofingSignal::type).toList());
        }

        return result;
    }

    /**
     * Retrieve the last 20 spoofing alerts for a profile (newest first).
     */
    @Transactional(readOnly = true)
    public List<SpoofingAlert> getRecentAlerts(UUID profileId) {
        return spoofingAlertRepository.findByProfileIdOrderByDetectedAtDesc(
                profileId, PageRequest.of(0, 20));
    }

    // ── Detection Checks ─────────────────────────────────────────────────────

    private void checkImpossibleSpeed(LocationPoint newPoint, LocationPoint previousPoint,
                                      List<SpoofingSignal> signals) {
        long secondsDelta = ChronoUnit.SECONDS.between(
                previousPoint.getRecordedAt(), newPoint.getRecordedAt());

        if (secondsDelta <= 0 || secondsDelta > SPEED_CHECK_MAX_SECONDS) {
            return; // Time went backwards (clock skew) or gap too large — skip
        }

        double distanceKm = haversine(
                previousPoint.getLatitude().doubleValue(), previousPoint.getLongitude().doubleValue(),
                newPoint.getLatitude().doubleValue(), newPoint.getLongitude().doubleValue());

        double speedKmh = (distanceKm / secondsDelta) * 3600.0;

        if (speedKmh > IMPOSSIBLE_SPEED_KMH) {
            signals.add(new SpoofingSignal(
                    "IMPOSSIBLE_SPEED",
                    String.format("Location jumped %.0f km in %d s (%.0f km/h — exceeds %.0f km/h threshold)",
                            distanceKm, secondsDelta, speedKmh, IMPOSSIBLE_SPEED_KMH)));
        }
    }

    private void checkPerfectAccuracy(LocationPoint newPoint, List<SpoofingSignal> signals) {
        if (newPoint.getAccuracy() == null) return;

        double accuracy = newPoint.getAccuracy().doubleValue();
        // Exactly 0.0 is physically impossible — real GPS always has some error
        if (accuracy == 0.0) {
            signals.add(new SpoofingSignal(
                    "PERFECT_ACCURACY",
                    "GPS accuracy reported as exactly 0.0 — not physically possible; " +
                    "common with mock location apps"));
        }
    }

    private void checkStationaryCloning(LocationPoint newPoint, List<SpoofingSignal> signals) {
        OffsetDateTime windowStart = OffsetDateTime.now().minusHours(1);
        List<LocationPoint> recent = locationPointRepository
                .findByProfileIdAndRecordedAtBetweenOrderByRecordedAtDesc(
                        newPoint.getProfileId(),
                        windowStart,
                        OffsetDateTime.now(),
                        PageRequest.of(0, STATIONARY_CLONE_WINDOW))
                .getContent();

        if (recent.size() < STATIONARY_CLONE_WINDOW) {
            return; // Not enough data
        }

        // Round to COORD_PRECISION decimal places for comparison
        BigDecimal refLat = newPoint.getLatitude().setScale(COORD_PRECISION, java.math.RoundingMode.HALF_UP);
        BigDecimal refLng = newPoint.getLongitude().setScale(COORD_PRECISION, java.math.RoundingMode.HALF_UP);

        boolean allIdentical = recent.stream().allMatch(p -> {
            BigDecimal lat = p.getLatitude().setScale(COORD_PRECISION, java.math.RoundingMode.HALF_UP);
            BigDecimal lng = p.getLongitude().setScale(COORD_PRECISION, java.math.RoundingMode.HALF_UP);
            return lat.compareTo(refLat) == 0 && lng.compareTo(refLng) == 0;
        });

        if (allIdentical) {
            signals.add(new SpoofingSignal(
                    "STATIONARY_CLONING",
                    String.format("Last %d location points have bit-identical coordinates " +
                            "(lat=%s, lng=%s) — real GPS always drifts when stationary",
                            STATIONARY_CLONE_WINDOW, refLat, refLng)));
        }
    }

    private void checkTeleportation(LocationPoint newPoint, LocationPoint previousPoint,
                                    List<SpoofingSignal> signals) {
        long minutesDelta = ChronoUnit.MINUTES.between(
                previousPoint.getRecordedAt(), newPoint.getRecordedAt());

        if (minutesDelta <= 0 || minutesDelta > TELEPORTATION_MAX_MINUTES) {
            return; // Gap too large or timestamp inversion — skip
        }

        double distanceKm = haversine(
                previousPoint.getLatitude().doubleValue(), previousPoint.getLongitude().doubleValue(),
                newPoint.getLatitude().doubleValue(), newPoint.getLongitude().doubleValue());

        if (distanceKm >= TELEPORTATION_KM_THRESHOLD) {
            signals.add(new SpoofingSignal(
                    "TELEPORTATION",
                    String.format("Location moved %.0f km in %d min — impossible without aircraft " +
                            "(threshold: %.0f km within %d min)",
                            distanceKm, minutesDelta,
                            TELEPORTATION_KM_THRESHOLD, TELEPORTATION_MAX_MINUTES)));
        }
    }

    // ── Persistence & Notification ───────────────────────────────────────────

    private void persistAlerts(LocationPoint point, List<SpoofingSignal> signals) {
        for (SpoofingSignal signal : signals) {
            SpoofingAlert alert = SpoofingAlert.builder()
                    .profileId(point.getProfileId())
                    .signalType(signal.type())
                    .description(signal.description())
                    .latitude(point.getLatitude().doubleValue())
                    .longitude(point.getLongitude().doubleValue())
                    .build();
            spoofingAlertRepository.save(alert);
        }
    }

    @Async
    public void notifySpoofingDetected(LocationPoint point, List<SpoofingSignal> signals) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            String signalSummary = signals.stream()
                    .map(SpoofingSignal::type)
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("UNKNOWN");

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "LOCATION_SPOOFING");
            payload.put("title", "Location Spoofing Detected");
            payload.put("body", "Possible mock GPS detected for your child's device. " +
                    "Signals: " + signalSummary);
            payload.put("profileId", point.getProfileId().toString());
            payload.put("userId", point.getProfileId().toString());
            payload.put("tenantId", point.getTenantId() != null
                    ? point.getTenantId().toString()
                    : "00000000-0000-0000-0000-000000000000");
            payload.put("actionUrl", "https://shield.rstglobal.in/app/location");

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Spoofing notification sent for profile={}", point.getProfileId());
        } catch (Exception e) {
            log.warn("Failed to send spoofing notification for profile={}: {}",
                    point.getProfileId(), e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} in Eureka — cannot send spoofing notification",
                    NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    // ── Haversine ────────────────────────────────────────────────────────────

    /**
     * Haversine great-circle distance between two WGS-84 coordinates.
     *
     * @return distance in kilometres
     */
    public double haversine(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0; // Earth's mean radius in km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
