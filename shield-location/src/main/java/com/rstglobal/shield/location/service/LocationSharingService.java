package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.CreateShareRequest;
import com.rstglobal.shield.location.dto.response.LocationShareResponse;
import com.rstglobal.shield.location.dto.response.SharedLocationResponse;
import com.rstglobal.shield.location.entity.LocationPoint;
import com.rstglobal.shield.location.entity.LocationShare;
import com.rstglobal.shield.location.repository.LocationPointRepository;
import com.rstglobal.shield.location.repository.LocationShareRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class LocationSharingService {

    private static final String SHARE_BASE_URL  = "https://shield.rstglobal.in/share/";
    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";

    private final LocationShareRepository    locationShareRepo;
    private final LocationPointRepository    locationPointRepo;
    private final DiscoveryClient            discoveryClient;
    private final RestClient                 restClient;
    private final SecureRandom               secureRandom;

    public LocationSharingService(LocationShareRepository locationShareRepo,
                                  LocationPointRepository locationPointRepo,
                                  DiscoveryClient discoveryClient) {
        this.locationShareRepo = locationShareRepo;
        this.locationPointRepo = locationPointRepo;
        this.discoveryClient   = discoveryClient;
        this.restClient        = RestClient.builder().build();
        this.secureRandom      = new SecureRandom();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Creates a time-limited shareable location link for a child profile.
     * Generates a cryptographically secure 32-character URL-safe token.
     */
    @Transactional
    public LocationShareResponse createShare(UUID createdBy, CreateShareRequest req) {
        String token = generateToken();

        LocationShare share = LocationShare.builder()
                .profileId(req.getProfileId())
                .createdBy(createdBy)
                .shareToken(token)
                .label(req.getLabel())
                .expiresAt(OffsetDateTime.now().plusHours(req.getDurationHours()))
                .maxViews(req.getMaxViews())
                .build();

        share = locationShareRepo.save(share);
        log.info("Location share created: token={} profileId={} durationHours={} createdBy={}",
                token, req.getProfileId(), req.getDurationHours(), createdBy);
        return toShareResponse(share);
    }

    /**
     * Validates the share token and returns the child's latest location.
     * Increments view count on every successful retrieval.
     * Throws 404 if token not found/inactive, 410 if expired or view limit reached.
     */
    @Transactional
    public SharedLocationResponse getSharedLocation(String token) {
        LocationShare share = locationShareRepo.findByShareTokenAndIsActiveTrue(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Share link not found or has been revoked"));

        if (share.getExpiresAt().isBefore(OffsetDateTime.now())) {
            share.setIsActive(false);
            locationShareRepo.save(share);
            throw new ResponseStatusException(HttpStatus.GONE, "Share link has expired");
        }

        if (share.getMaxViews() != null && share.getViewCount() >= share.getMaxViews()) {
            share.setIsActive(false);
            locationShareRepo.save(share);
            throw new ResponseStatusException(HttpStatus.GONE, "Share link view limit reached");
        }

        // Increment view counter
        share.setViewCount(share.getViewCount() + 1);
        locationShareRepo.save(share);

        // Fetch latest location
        LocationPoint point = locationPointRepo
                .findFirstByProfileIdOrderByRecordedAtDesc(share.getProfileId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No location data available for this profile"));

        // Resolve child name from shield-profile (non-critical — fallback to "Child")
        String childName = resolveChildName(share.getProfileId());

        log.debug("Shared location viewed: token={} profileId={} viewCount={}",
                token, share.getProfileId(), share.getViewCount());

        return SharedLocationResponse.builder()
                .profileId(share.getProfileId())
                .name(childName)
                .latitude(point.getLatitude())
                .longitude(point.getLongitude())
                .accuracy(point.getAccuracy())
                .recordedAt(point.getRecordedAt())
                .shareLabel(share.getLabel())
                .expiresAt(share.getExpiresAt())
                .build();
    }

    /**
     * Revokes a share by setting isActive=false.
     * Only the user who created the share may revoke it.
     */
    @Transactional
    public void revokeShare(UUID shareId, UUID userId) {
        LocationShare share = locationShareRepo.findById(shareId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Share not found: " + shareId));

        if (!share.getCreatedBy().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You are not authorised to revoke this share");
        }

        share.setIsActive(false);
        locationShareRepo.save(share);
        log.info("Location share revoked: shareId={} by userId={}", shareId, userId);
    }

    /**
     * Lists all active shares for a given profile.
     */
    @Transactional(readOnly = true)
    public List<LocationShareResponse> listShares(UUID profileId) {
        return locationShareRepo
                .findByProfileIdAndIsActiveTrueOrderByCreatedAtDesc(profileId)
                .stream()
                .map(this::toShareResponse)
                .toList();
    }

    /**
     * Scheduled cleanup: marks expired shares as inactive.
     * Runs every hour.
     */
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void expireOldShares() {
        int count = locationShareRepo.deactivateExpired(OffsetDateTime.now());
        if (count > 0) {
            log.info("Expired {} stale location share(s)", count);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Generates a 32-character URL-safe Base64 token from 24 random bytes.
     * Uses SecureRandom to ensure cryptographic strength.
     */
    private String generateToken() {
        byte[] bytes = new byte[24];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Calls shield-profile internal endpoint to get the child's display name.
     * Returns "Child" if the call fails or the service is unavailable.
     */
    @SuppressWarnings("unchecked")
    private String resolveChildName(UUID profileId) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(PROFILE_SERVICE);
            if (instances.isEmpty()) {
                log.warn("resolveChildName: {} not found in Eureka for profileId={}", PROFILE_SERVICE, profileId);
                return "Child";
            }
            String baseUrl = instances.get(0).getUri().toString();
            Map<String, Object> profile = restClient.get()
                    .uri(baseUrl + "/internal/profiles/" + profileId)
                    .retrieve()
                    .body(Map.class);
            if (profile != null && profile.containsKey("name")) {
                return (String) profile.get("name");
            }
        } catch (Exception e) {
            log.warn("resolveChildName failed for profileId={}: {} — using fallback", profileId, e.getMessage());
        }
        return "Child";
    }

    private LocationShareResponse toShareResponse(LocationShare s) {
        return LocationShareResponse.builder()
                .id(s.getId())
                .profileId(s.getProfileId())
                .createdBy(s.getCreatedBy())
                .shareToken(s.getShareToken())
                .label(s.getLabel())
                .expiresAt(s.getExpiresAt())
                .maxViews(s.getMaxViews())
                .viewCount(s.getViewCount())
                .isActive(s.getIsActive())
                .createdAt(s.getCreatedAt())
                .shareUrl(SHARE_BASE_URL + s.getShareToken())
                .build();
    }
}
