package com.rstglobal.shield.rewards.controller;

import com.rstglobal.shield.rewards.dto.response.BadgeResponse;
import com.rstglobal.shield.rewards.dto.response.ProfileBadgeResponse;
import com.rstglobal.shield.rewards.service.BadgeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/rewards/badges")
@RequiredArgsConstructor
public class BadgeController {

    private final BadgeService badgeService;

    /**
     * Returns all badge definitions (catalog).
     * Used by the child app to show the full badge gallery.
     */
    @GetMapping
    public ResponseEntity<List<BadgeResponse>> getAllBadges() {
        return ResponseEntity.ok(badgeService.getAllBadges());
    }

    /**
     * Returns badges already earned by a specific child profile.
     */
    @GetMapping("/profile/{profileId}")
    public ResponseEntity<List<ProfileBadgeResponse>> getProfileBadges(@PathVariable UUID profileId) {
        return ResponseEntity.ok(badgeService.getProfileBadges(profileId));
    }

    /**
     * Manually triggers a badge eligibility check for a profile.
     * Returns any newly awarded badges.
     * Useful for testing or after bulk point imports.
     */
    @PostMapping("/check/{profileId}")
    public ResponseEntity<List<ProfileBadgeResponse>> checkBadges(@PathVariable UUID profileId) {
        log.info("Manual badge check triggered for profile {}", profileId);
        List<ProfileBadgeResponse> awarded = badgeService.checkAndAwardBadges(profileId);
        return ResponseEntity.ok(awarded);
    }

    /**
     * Admin endpoint: manually award a specific badge to a profile.
     * Silently skips if already earned.
     */
    @PostMapping("/award/{profileId}/{badgeId}")
    public ResponseEntity<ProfileBadgeResponse> awardBadge(
            @PathVariable UUID profileId,
            @PathVariable String badgeId) {
        log.info("Admin awarding badge {} to profile {}", badgeId, profileId);
        ProfileBadgeResponse response = badgeService.awardBadge(profileId, badgeId);
        return ResponseEntity.ok(response);
    }
}
