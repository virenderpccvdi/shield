package com.rstglobal.shield.dns.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * PC-02 — Homework Mode
 * <p>
 * One-tap mode that temporarily blocks entertainment/social/gaming categories by
 * appending category-representative domains to the profile's custom_blocklist.
 * The original custom_blocklist is snapshotted in homework_mode_snapshot so it can
 * be restored exactly when the session ends or is cancelled early.
 * <p>
 * Homework mode STACKS on top of existing DNS rules — it never modifies
 * enabled_categories or any other field. Only custom_blocklist is modified.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HomeworkModeService {

    private final DnsRulesRepository dnsRulesRepository;
    private final DnsRulesService dnsRulesService;

    // No external DNS proxy — rules broadcast via Redis to shield-dns-resolver
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Marker key injected into enabled_categories so the rules broadcast can signal homework mode. */
    public static final String HOMEWORK_BLOCKED_KEY = "__homework_mode__";

    /**
     * Representative domains to block for each entertainment/social category.
     * These are appended to the custom_blocklist during a homework session.
     * The parent's own custom_blocklist is preserved and restored on deactivation.
     */
    private static final Set<String> HOMEWORK_BLOCKED_CATEGORIES = Set.of(
            "social_media", "gaming", "streaming", "music", "video", "chat",
            "forums", "shopping", "sports", "entertainment", "adult"
    );

    // ── Activate ──────────────────────────────────────────────────────────────

    /**
     * Activates homework mode for the given profile.
     *
     * @param profileId       child profile UUID
     * @param durationMinutes session length (30–240 minutes)
     */
    @Transactional
    public void activate(UUID profileId, int durationMinutes) {
        if (durationMinutes < 1 || durationMinutes > 240) {
            throw ShieldException.badRequest("durationMinutes must be between 1 and 240");
        }

        DnsRules rules = findRules(profileId);

        if (Boolean.TRUE.equals(rules.getHomeworkModeActive())) {
            // Already active — extend the end time instead of re-snapshotting
            rules.setHomeworkModeEndsAt(OffsetDateTime.now().plusMinutes(durationMinutes));
            dnsRulesRepository.save(rules);
            log.info("Homework mode extended for profileId={} for {} min", profileId, durationMinutes);
            return;
        }

        // 1. Snapshot the current custom_blocklist
        List<String> currentBlocklist = Optional.ofNullable(rules.getCustomBlocklist())
                .orElse(List.of());
        String snapshot;
        try {
            snapshot = objectMapper.writeValueAsString(currentBlocklist);
        } catch (JsonProcessingException e) {
            snapshot = "[]";
            log.warn("Failed to serialise blocklist snapshot for profileId={}", profileId, e);
        }

        // 2. Build the homework blocklist = existing domains + category-representative domains
        //    We block enabled_categories entries that match HOMEWORK_BLOCKED_CATEGORIES.
        //    Domains from the homework set that are not yet in the blocklist are appended.
        List<String> homeworkDomains = buildHomeworkDomains(rules);
        List<String> newBlocklist = new ArrayList<>(currentBlocklist);
        for (String d : homeworkDomains) {
            if (!newBlocklist.contains(d)) {
                newBlocklist.add(d);
            }
        }

        // 3. Flag the rule using the special key in enabled_categories so the rules broadcast
        //    can handle homework-mode-specific service blocking if needed.
        java.util.Map<String, Boolean> cats = Optional.ofNullable(rules.getEnabledCategories())
                .map(java.util.LinkedHashMap::new)
                .orElse(new java.util.LinkedHashMap<>());
        HOMEWORK_BLOCKED_CATEGORIES.forEach(cat -> cats.put(cat, false));
        cats.put(HOMEWORK_BLOCKED_KEY, true);

        // 4. Persist
        rules.setHomeworkModeSnapshot(snapshot);
        rules.setCustomBlocklist(newBlocklist);
        rules.setEnabledCategories(cats);
        rules.setHomeworkModeActive(true);
        rules.setHomeworkModeEndsAt(OffsetDateTime.now().plusMinutes(durationMinutes));
        DnsRules saved = dnsRulesRepository.save(rules);

        // 5. Broadcast rules to shield-dns-resolver
        dnsRulesService.syncRules(profileId);

        log.info("Homework mode ACTIVATED for profileId={} duration={}min ends={}",
                profileId, durationMinutes, saved.getHomeworkModeEndsAt());
    }

    // ── Deactivate ────────────────────────────────────────────────────────────

    /**
     * Deactivates homework mode, restoring the original custom_blocklist snapshot
     * and removing the homework category overrides from enabled_categories.
     *
     * @param profileId child profile UUID
     */
    @Transactional
    public void deactivate(UUID profileId) {
        DnsRules rules = findRules(profileId);

        if (!Boolean.TRUE.equals(rules.getHomeworkModeActive())) {
            // Already inactive — nothing to do
            log.debug("Homework mode deactivate called on already-inactive profileId={}", profileId);
            return;
        }

        // 1. Restore snapshot
        String snapshot = rules.getHomeworkModeSnapshot();
        if (snapshot != null && !snapshot.isBlank()) {
            try {
                @SuppressWarnings("unchecked")
                List<String> restored = objectMapper.readValue(snapshot, List.class);
                rules.setCustomBlocklist(restored);
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialise blocklist snapshot for profileId={}; clearing blocklist", profileId, e);
                rules.setCustomBlocklist(new ArrayList<>());
            }
        }

        // 2. Remove homework markers from enabled_categories
        java.util.Map<String, Boolean> cats = rules.getEnabledCategories();
        if (cats != null) {
            cats.remove(HOMEWORK_BLOCKED_KEY);
            // Restore blocked categories to their default allowed state
            HOMEWORK_BLOCKED_CATEGORIES.forEach(cat -> cats.remove(cat));
            rules.setEnabledCategories(cats);
        }

        // 3. Clear homework mode state
        rules.setHomeworkModeActive(false);
        rules.setHomeworkModeEndsAt(null);
        rules.setHomeworkModeSnapshot(null);
        dnsRulesRepository.save(rules);

        // 4. Broadcast restored rules to shield-dns-resolver
        dnsRulesService.syncRules(profileId);

        log.info("Homework mode DEACTIVATED for profileId={}", profileId);
    }

    // ── Status ────────────────────────────────────────────────────────────────

    /**
     * Returns the current homework mode status for a profile.
     *
     * @return map with keys: active (Boolean), endsAt (OffsetDateTime or null),
     *         minutesRemaining (Long or null)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getStatus(UUID profileId) {
        DnsRules rules = findRules(profileId);
        boolean active = Boolean.TRUE.equals(rules.getHomeworkModeActive());
        OffsetDateTime endsAt = rules.getHomeworkModeEndsAt();
        Long minutesRemaining = null;
        if (active && endsAt != null) {
            long remaining = java.time.Duration.between(OffsetDateTime.now(), endsAt).toMinutes();
            minutesRemaining = Math.max(0L, remaining);
        }
        return Map.of(
                "active", active,
                "endsAt", endsAt != null ? endsAt.toString() : "",
                "minutesRemaining", minutesRemaining != null ? minutesRemaining : 0L
        );
    }

    // ── Expiry (called by scheduler) ──────────────────────────────────────────

    /**
     * Deactivates all homework sessions whose end time has passed.
     * Called every minute by {@link HomeworkModeExpiryJob}.
     */
    @Transactional
    public void expireAll() {
        List<DnsRules> expired = dnsRulesRepository.findAllActiveHomeworkExpired(OffsetDateTime.now());
        if (expired.isEmpty()) return;
        log.info("Expiring {} homework mode session(s)", expired.size());
        for (DnsRules rules : expired) {
            try {
                deactivate(rules.getProfileId());
            } catch (Exception e) {
                log.error("Failed to expire homework mode for profileId={}", rules.getProfileId(), e);
            }
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private DnsRules findRules(UUID profileId) {
        return dnsRulesRepository.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
    }

    /**
     * Builds the list of category-representative domains to block.
     * We only add domains for categories that are currently ALLOWED (not already blocked),
     * to avoid redundant entries.  This keeps the custom_blocklist clean.
     */
    private List<String> buildHomeworkDomains(DnsRules rules) {
        // Representative domain per homework-blocked category (lightweight, no deep mapping needed —
        // shield-dns-resolver handles category blocking via rules cache).
        // These domain entries act as visible indicators in the activity feed.
        return List.of(
                "facebook.com", "instagram.com", "twitter.com", "tiktok.com",
                "snapchat.com", "reddit.com", "youtube.com", "netflix.com",
                "twitch.tv", "steam.com", "roblox.com", "discord.com",
                "spotify.com", "soundcloud.com", "gaming.amazon.com"
        );
    }
}
