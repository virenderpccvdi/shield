package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.CheckinReminderRequest;
import com.rstglobal.shield.location.dto.response.CheckinReminderResponse;
import com.rstglobal.shield.location.entity.CheckinReminderSettings;
import com.rstglobal.shield.location.repository.CheckinReminderSettingsRepository;
import com.rstglobal.shield.location.repository.LocationPointRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class CheckinReminderService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";
    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final CheckinReminderSettingsRepository repo;
    private final LocationPointRepository locationRecordRepo;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public CheckinReminderService(CheckinReminderSettingsRepository repo,
                                  LocationPointRepository locationRecordRepo,
                                  DiscoveryClient discoveryClient) {
        this.repo = repo;
        this.locationRecordRepo = locationRecordRepo;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    // -------------------------------------------------------------------------
    // Settings management
    // -------------------------------------------------------------------------

    @Transactional
    public CheckinReminderResponse upsertSettings(UUID profileId, CheckinReminderRequest req) {
        CheckinReminderSettings settings = repo.findByProfileId(profileId)
                .orElseGet(() -> CheckinReminderSettings.builder()
                        .profileId(profileId)
                        .enabled(Boolean.TRUE)
                        .reminderIntervalMin(60)
                        .build());

        if (req.getEnabled() != null) {
            settings.setEnabled(req.getEnabled());
        }
        if (req.getReminderIntervalMin() != null) {
            settings.setReminderIntervalMin(req.getReminderIntervalMin());
        }
        if (req.getQuietStart() != null) {
            settings.setQuietStart(req.getQuietStart().isBlank() ? null : LocalTime.parse(req.getQuietStart(), TIME_FMT));
        }
        if (req.getQuietEnd() != null) {
            settings.setQuietEnd(req.getQuietEnd().isBlank() ? null : LocalTime.parse(req.getQuietEnd(), TIME_FMT));
        }

        settings = repo.save(settings);
        log.info("Checkin reminder settings upserted for profile={} enabled={} intervalMin={}",
                profileId, settings.getEnabled(), settings.getReminderIntervalMin());
        return toResponse(settings);
    }

    @Transactional(readOnly = true)
    public Optional<CheckinReminderResponse> getSettings(UUID profileId) {
        return repo.findByProfileId(profileId).map(this::toResponse);
    }

    // -------------------------------------------------------------------------
    // Scheduled check — runs every 5 minutes
    // -------------------------------------------------------------------------

    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void checkAll() {
        List<CheckinReminderSettings> allSettings = repo.findByEnabledTrue();
        if (allSettings.isEmpty()) return;

        log.debug("Checkin reminder scan: {} enabled profiles", allSettings.size());

        for (CheckinReminderSettings s : allSettings) {
            try {
                // Check quiet hours
                LocalTime now = LocalTime.now();
                if (s.getQuietStart() != null && s.getQuietEnd() != null) {
                    if (isInQuietHours(now, s.getQuietStart(), s.getQuietEnd())) {
                        log.debug("Checkin reminder suppressed for profile={} — in quiet hours ({}-{})",
                                s.getProfileId(), s.getQuietStart(), s.getQuietEnd());
                        continue;
                    }
                }

                // Find last recorded location
                var lastLocation = locationRecordRepo.findFirstByProfileIdOrderByRecordedAtDesc(s.getProfileId());
                if (lastLocation.isEmpty()) {
                    log.debug("Checkin reminder: no location records for profile={}, skipping", s.getProfileId());
                    continue;
                }

                OffsetDateTime lastSeen = lastLocation.get().getRecordedAt();
                long minutesSince = ChronoUnit.MINUTES.between(lastSeen, OffsetDateTime.now());

                if (minutesSince < s.getReminderIntervalMin()) {
                    log.debug("Checkin reminder: profile={} last seen {}m ago (threshold={}m) — OK",
                            s.getProfileId(), minutesSince, s.getReminderIntervalMin());
                    continue;
                }

                // Check cooldown: don't re-alert until another full interval has passed
                if (s.getLastReminderSent() != null) {
                    long minutesSinceAlert = ChronoUnit.MINUTES.between(s.getLastReminderSent(), OffsetDateTime.now());
                    if (minutesSinceAlert < s.getReminderIntervalMin()) {
                        log.debug("Checkin reminder: profile={} — cooldown active (last alert {}m ago)",
                                s.getProfileId(), minutesSinceAlert);
                        continue;
                    }
                }

                // Fire the alert
                sendCheckinAlert(s.getProfileId(), minutesSince);
                s.setLastReminderSent(OffsetDateTime.now());
                repo.save(s);

            } catch (Exception e) {
                log.warn("Checkin reminder check failed for profile={}: {}", s.getProfileId(), e.getMessage());
            }
        }
    }

    // -------------------------------------------------------------------------
    // Notification dispatch
    // -------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private void sendCheckinAlert(UUID profileId, long minutesSince) {
        try {
            String notifBaseUrl = resolveNotificationUrl();
            if (notifBaseUrl == null) {
                log.error("Checkin reminder FAILED — notification service not found in Eureka for profile={}", profileId);
                return;
            }

            Map<String, Object> parentInfo = resolveParentInfo(profileId);
            String parentUserId = (String) parentInfo.get("userId");

            if (parentUserId == null) {
                log.error("Checkin reminder FCM skipped — could not resolve parent userId for profile={}", profileId);
                return;
            }

            Map<String, Object> pushPayload = new java.util.LinkedHashMap<>();
            pushPayload.put("userId",   parentUserId);
            pushPayload.put("title",    "\uD83D\uDCCD Location Check-in Reminder");
            pushPayload.put("body",     "Your child hasn't shared their location in " + minutesSince + " minutes.");
            pushPayload.put("priority", "NORMAL");
            pushPayload.put("data",     Map.of(
                    "type",      "CHECKIN_REMINDER",
                    "profileId", profileId.toString()
            ));

            restClient.post()
                    .uri(notifBaseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(pushPayload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Checkin reminder sent for profile={} → parent={} ({}m since last location)",
                    profileId, parentUserId, minutesSince);

        } catch (Exception e) {
            log.warn("Checkin reminder alert failed for profile={}: {}", profileId, e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Returns true when {@code now} falls within [start, end).
     * Handles overnight ranges where start > end (e.g. 22:00–06:00).
     */
    private boolean isInQuietHours(LocalTime now, LocalTime start, LocalTime end) {
        if (start.isBefore(end)) {
            // Same-day window: e.g. 22:00–23:59 or 08:00–20:00
            return !now.isBefore(start) && now.isBefore(end);
        }
        // Overnight window: e.g. 22:00–06:00
        return !now.isBefore(start) || now.isBefore(end);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveParentInfo(UUID profileId) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(PROFILE_SERVICE);
            if (instances.isEmpty()) {
                log.error("Checkin reminder parent resolution FAILED — {} has no instances in Eureka for profile={}",
                        PROFILE_SERVICE, profileId);
                return new HashMap<>();
            }
            String profileBaseUrl = instances.get(0).getUri().toString();
            Map<String, Object> result = restClient.get()
                    .uri(profileBaseUrl + "/internal/profiles/" + profileId + "/parent")
                    .retrieve()
                    .body(Map.class);
            if (result == null || !result.containsKey("userId")) {
                log.error("Checkin reminder parent resolution FAILED — profile service returned no userId for profile={}",
                        profileId);
                return new HashMap<>();
            }
            return result;
        } catch (Exception e) {
            log.error("Checkin reminder parent resolution FAILED for profile={}: {}", profileId, e.getMessage());
            return new HashMap<>();
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private CheckinReminderResponse toResponse(CheckinReminderSettings s) {
        return CheckinReminderResponse.builder()
                .id(s.getId())
                .profileId(s.getProfileId())
                .enabled(s.getEnabled())
                .reminderIntervalMin(s.getReminderIntervalMin())
                .quietStart(s.getQuietStart() != null ? s.getQuietStart().format(TIME_FMT) : null)
                .quietEnd(s.getQuietEnd() != null ? s.getQuietEnd().format(TIME_FMT) : null)
                .lastReminderSent(s.getLastReminderSent())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
