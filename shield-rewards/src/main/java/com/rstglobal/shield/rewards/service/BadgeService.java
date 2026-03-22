package com.rstglobal.shield.rewards.service;

import com.rstglobal.shield.rewards.dto.response.BadgeResponse;
import com.rstglobal.shield.rewards.dto.response.ProfileBadgeResponse;
import com.rstglobal.shield.rewards.entity.Badge;
import com.rstglobal.shield.rewards.entity.ProfileBadge;
import com.rstglobal.shield.rewards.repository.BadgeRepository;
import com.rstglobal.shield.rewards.repository.ProfileBadgeRepository;
import com.rstglobal.shield.rewards.repository.RewardBankRepository;
import com.rstglobal.shield.rewards.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BadgeService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final BadgeRepository badgeRepository;
    private final ProfileBadgeRepository profileBadgeRepository;
    private final RewardBankRepository rewardBankRepository;
    private final TaskRepository taskRepository;
    private final DiscoveryClient discoveryClient;

    @Value("${shield.notification.base-url:http://localhost:8286}")
    private String notifBaseUrl;

    private final RestClient restClient = RestClient.builder().build();

    // ── Read operations ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<BadgeResponse> getAllBadges() {
        return badgeRepository.findAll()
                .stream()
                .map(this::toBadgeResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProfileBadgeResponse> getProfileBadges(UUID profileId) {
        return profileBadgeRepository.findByProfileId(profileId)
                .stream()
                .map(this::toProfileBadgeResponse)
                .collect(Collectors.toList());
    }

    // ── Badge check & award ───────────────────────────────────────────────────

    /**
     * Checks all badge thresholds for the given profile and awards any not yet earned.
     * Called after task completion or points change.
     */
    @Transactional
    public List<ProfileBadgeResponse> checkAndAwardBadges(UUID profileId) {
        long taskCount = countApprovedAndCompletedTasks(profileId);
        int streakDays = rewardBankRepository.findByProfileId(profileId)
                .map(b -> b.getStreakDays())
                .orElse(0);
        int totalPoints = rewardBankRepository.findByProfileId(profileId)
                .map(b -> b.getTotalEarnedPoints())
                .orElse(0);

        List<Badge> allBadges = badgeRepository.findAll();
        List<ProfileBadgeResponse> newlyEarned = new ArrayList<>();

        for (Badge badge : allBadges) {
            if (profileBadgeRepository.existsByProfileIdAndBadgeId(profileId, badge.getId())) {
                continue; // already earned
            }

            boolean earned = switch (badge.getCategory()) {
                case "TASKS"    -> evaluateTasksBadge(badge.getId(), taskCount, totalPoints);
                case "STREAK"   -> evaluateStreakBadge(badge.getId(), streakDays);
                case "SAFETY"   -> false; // awarded externally via awardBadge()
                case "LEARNING" -> false; // awarded externally via awardBadge()
                default         -> false;
            };

            if (earned) {
                ProfileBadge pb = doAwardBadge(profileId, badge);
                newlyEarned.add(toProfileBadgeResponse(pb));
                sendBadgeEarnedPushAsync(profileId, badge);
            }
        }

        if (!newlyEarned.isEmpty()) {
            log.info("Awarded {} new badge(s) to profile {}: {}",
                    newlyEarned.size(), profileId,
                    newlyEarned.stream().map(ProfileBadgeResponse::getBadgeId).collect(Collectors.joining(", ")));
        }

        return newlyEarned;
    }

    /**
     * Manually award a specific badge to a profile (admin / external service use).
     * Silently skips if already earned.
     */
    @Transactional
    public ProfileBadgeResponse awardBadge(UUID profileId, String badgeId) {
        if (profileBadgeRepository.existsByProfileIdAndBadgeId(profileId, badgeId)) {
            // already earned — return the existing record
            return profileBadgeRepository.findByProfileId(profileId)
                    .stream()
                    .filter(pb -> pb.getBadge().getId().equals(badgeId))
                    .findFirst()
                    .map(this::toProfileBadgeResponse)
                    .orElse(null);
        }

        Badge badge = badgeRepository.findById(badgeId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown badge: " + badgeId));

        ProfileBadge pb = doAwardBadge(profileId, badge);
        sendBadgeEarnedPushAsync(profileId, badge);
        log.info("Manually awarded badge {} to profile {}", badgeId, profileId);
        return toProfileBadgeResponse(pb);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private long countApprovedAndCompletedTasks(UUID profileId) {
        long approved  = taskRepository.findByProfileIdAndStatus(profileId, "APPROVED").size();
        long completed = taskRepository.findByProfileIdAndStatus(profileId, "COMPLETED").size();
        return approved + completed;
    }

    private boolean evaluateTasksBadge(String badgeId, long taskCount, int totalPoints) {
        return switch (badgeId) {
            case "FIRST_TASK"  -> taskCount >= 1;
            case "TASK_5"      -> taskCount >= 5;
            case "TASK_10"     -> taskCount >= 10;
            case "TASK_25"     -> taskCount >= 25;
            case "POINTS_100"  -> totalPoints >= 100;
            case "POINTS_500"  -> totalPoints >= 500;
            case "FIRST_REWARD"-> false; // awarded externally via awardBadge()
            default            -> false;
        };
    }

    private boolean evaluateStreakBadge(String badgeId, int streakDays) {
        return switch (badgeId) {
            case "STREAK_3" -> streakDays >= 3;
            case "STREAK_7" -> streakDays >= 7;
            default         -> false;
        };
    }

    private ProfileBadge doAwardBadge(UUID profileId, Badge badge) {
        ProfileBadge pb = ProfileBadge.builder()
                .profileId(profileId)
                .badge(badge)
                .earnedAt(OffsetDateTime.now())
                .build();
        return profileBadgeRepository.save(pb);
    }

    // ── Push notification ─────────────────────────────────────────────────────

    @Async
    protected void sendBadgeEarnedPushAsync(UUID profileId, Badge badge) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) {
                log.warn("No SHIELD-NOTIFICATION instance found — skipping badge push for profile {}", profileId);
                return;
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("userId", null);
            payload.put("topic", "profile-" + profileId);
            payload.put("title", "\uD83C\uDFC6 New Badge Earned!");
            payload.put("body", "You earned the '" + badge.getName() + "' badge: " + badge.getDescription());
            payload.put("priority", "HIGH");
            payload.put("data", Map.of(
                    "type",    "BADGE_EARNED",
                    "badgeId", badge.getId(),
                    "emoji",   badge.getIconEmoji()
            ));

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Badge push sent: profileId={} badge={}", profileId, badge.getId());
        } catch (Exception e) {
            log.warn("Badge push notification failed for profile {}: {}", profileId, e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            return notifBaseUrl; // fallback to configured URL
        }
        return instances.get(0).getUri().toString();
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private BadgeResponse toBadgeResponse(Badge badge) {
        return BadgeResponse.builder()
                .id(badge.getId())
                .name(badge.getName())
                .description(badge.getDescription())
                .iconEmoji(badge.getIconEmoji())
                .category(badge.getCategory())
                .threshold(badge.getThreshold())
                .build();
    }

    private ProfileBadgeResponse toProfileBadgeResponse(ProfileBadge pb) {
        return ProfileBadgeResponse.builder()
                .id(pb.getId())
                .profileId(pb.getProfileId())
                .badgeId(pb.getBadge().getId())
                .badgeName(pb.getBadge().getName())
                .badgeDescription(pb.getBadge().getDescription())
                .iconEmoji(pb.getBadge().getIconEmoji())
                .category(pb.getBadge().getCategory())
                .earnedAt(pb.getEarnedAt())
                .build();
    }
}
