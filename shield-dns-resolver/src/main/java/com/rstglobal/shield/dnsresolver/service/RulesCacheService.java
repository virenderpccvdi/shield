package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.client.DnsRulesClient;
import com.rstglobal.shield.dnsresolver.config.DnsProperties;
import com.rstglobal.shield.dnsresolver.model.BlockDecision;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Redis-backed rule lookup for DNS filtering.
 *
 * Redis key layout (all prefixed with shield:):
 *   shield:dns:client:{dnsClientId}         → profileId
 *   shield:dns:profile:{profileId}:blocklist → SET of blocked domains
 *   shield:dns:profile:{profileId}:allowlist → SET of allowed domains
 *   shield:dns:profile:{profileId}:categories → HASH category→blocked/allowed
 *   shield:dns:profile:{profileId}:schedule  → STRING JSON schedule
 *   shield:dns:profile:{profileId}:level     → STRING filterLevel (strict/moderate/minimal)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RulesCacheService {

    private static final String PREFIX = "shield:dns:";
    private static final String CLIENT_KEY = PREFIX + "client:";
    private static final String PROFILE_KEY = PREFIX + "profile:";

    // Categories always blocked regardless of filter level
    private static final Set<String> ALWAYS_BLOCKED = Set.of("adult", "gambling", "malware", "phishing");

    // Categories blocked in strict mode
    private static final Set<String> STRICT_BLOCKED = Set.of(
        "social_media", "gaming", "streaming", "music", "live_streaming",
        "vpn_proxy", "messaging", "dating", "drugs", "online_gaming", "esports"
    );

    // Categories blocked in moderate mode
    private static final Set<String> MODERATE_BLOCKED = Set.of("vpn_proxy", "dating", "drugs");

    private final ReactiveStringRedisTemplate redisTemplate;
    private final DnsRulesClient dnsRulesClient;
    private final DnsProperties dnsProperties;

    /**
     * Resolve dnsClientId → profileId (from Redis, with Feign fallback).
     */
    public Mono<String> getProfileId(String dnsClientId) {
        String key = CLIENT_KEY + dnsClientId;
        return redisTemplate.opsForValue().get(key)
            .switchIfEmpty(loadProfileIdFromService(dnsClientId));
    }

    /**
     * Check whether a domain should be blocked for a given profile.
     */
    public Mono<BlockDecision> check(String profileId, String domain, String category) {
        String baseKey = PROFILE_KEY + profileId;

        // 1. Check allowlist first (always overrides)
        return redisTemplate.opsForSet().isMember(baseKey + ":allowlist", domain)
            .flatMap(allowed -> {
                if (Boolean.TRUE.equals(allowed)) {
                    return Mono.just(BlockDecision.allowed());
                }
                // 2. Check custom blocklist
                return redisTemplate.opsForSet().isMember(baseKey + ":blocklist", domain);
            })
            .flatMap(result -> {
                if (result instanceof BlockDecision bd) {
                    return Mono.just(bd);
                }
                if (Boolean.TRUE.equals(result)) {
                    return Mono.just(BlockDecision.blocked("custom_blocklist"));
                }
                // 3. Check category-based blocking
                return checkCategoryBlock(profileId, category);
            })
            .flatMap(decision -> {
                if (decision.isBlocked()) return Mono.just(decision);
                // 4. Check schedule
                return checkSchedule(profileId);
            })
            .switchIfEmpty(Mono.just(BlockDecision.allowed()));
    }

    /**
     * Check if the domain's category is blocked for this profile.
     */
    private Mono<BlockDecision> checkCategoryBlock(String profileId, String category) {
        if (category == null) return Mono.just(BlockDecision.allowed());

        // Always block adult/gambling/malware
        if (ALWAYS_BLOCKED.contains(category)) {
            return Mono.just(BlockDecision.blocked("category:" + category));
        }

        String baseKey = PROFILE_KEY + profileId;

        // Check per-category override in Redis
        return redisTemplate.opsForHash().get(baseKey + ":categories", category)
            .map(val -> {
                if ("blocked".equals(val.toString())) {
                    return BlockDecision.blocked("category:" + category);
                }
                return BlockDecision.allowed();
            })
            .switchIfEmpty(
                // No per-category override, check filter level
                redisTemplate.opsForValue().get(baseKey + ":level")
                    .map(level -> checkLevelCategory(level, category))
                    .switchIfEmpty(Mono.just(BlockDecision.allowed()))
            );
    }

    private BlockDecision checkLevelCategory(String level, String category) {
        return switch (level) {
            case "strict" -> STRICT_BLOCKED.contains(category) || ALWAYS_BLOCKED.contains(category)
                ? BlockDecision.blocked("filter_level:strict:" + category)
                : BlockDecision.allowed();
            case "moderate" -> MODERATE_BLOCKED.contains(category) || ALWAYS_BLOCKED.contains(category)
                ? BlockDecision.blocked("filter_level:moderate:" + category)
                : BlockDecision.allowed();
            default -> ALWAYS_BLOCKED.contains(category)
                ? BlockDecision.blocked("filter_level:minimal:" + category)
                : BlockDecision.allowed();
        };
    }

    /**
     * Check if current time falls within a blocked schedule window.
     */
    private Mono<BlockDecision> checkSchedule(String profileId) {
        String baseKey = PROFILE_KEY + profileId;
        return redisTemplate.opsForValue().get(baseKey + ":schedule")
            .map(schedule -> {
                // Schedule format: "bedtime:22:00-06:00" or "school:08:00-15:00:monday,tuesday,wednesday,thursday,friday"
                if (schedule == null || schedule.isEmpty()) return BlockDecision.allowed();

                LocalDateTime now = LocalDateTime.now();
                String dayName = now.getDayOfWeek().name().toLowerCase();
                LocalTime currentTime = now.toLocalTime();

                String[] parts = schedule.split("\\|");
                for (String part : parts) {
                    String[] segments = part.split(":");
                    if (segments.length < 3) continue;

                    String scheduleName = segments[0];
                    try {
                        LocalTime start = LocalTime.parse(segments[1] + ":" + segments[2], DateTimeFormatter.ofPattern("HH:mm"));
                        LocalTime end = segments.length >= 5
                            ? LocalTime.parse(segments[3] + ":" + segments[4].split(",")[0], DateTimeFormatter.ofPattern("HH:mm"))
                            : start.plusHours(1);

                        // Check day restriction if present
                        if (part.contains(",")) {
                            String daysStr = part.substring(part.lastIndexOf(":") + 1);
                            String[] days = daysStr.split(",");
                            boolean dayMatch = false;
                            for (String d : days) {
                                if (d.trim().equalsIgnoreCase(dayName)) {
                                    dayMatch = true;
                                    break;
                                }
                            }
                            if (!dayMatch) continue;
                        }

                        // Handle overnight schedules (e.g. 22:00-06:00)
                        boolean inWindow;
                        if (start.isAfter(end)) {
                            inWindow = currentTime.isAfter(start) || currentTime.isBefore(end);
                        } else {
                            inWindow = currentTime.isAfter(start) && currentTime.isBefore(end);
                        }

                        if (inWindow) {
                            return BlockDecision.blocked("schedule:" + scheduleName);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse schedule segment: {}", part, e);
                    }
                }
                return BlockDecision.allowed();
            })
            .switchIfEmpty(Mono.just(BlockDecision.allowed()));
    }

    /**
     * Invalidate all cached rules for a profile.
     */
    public Mono<Void> invalidateProfile(String profileId) {
        String baseKey = PROFILE_KEY + profileId;
        return redisTemplate.delete(baseKey + ":blocklist", baseKey + ":allowlist",
                baseKey + ":categories", baseKey + ":schedule", baseKey + ":level")
            .then();
    }

    /**
     * Load rules from shield-dns via Feign and cache to Redis.
     */
    @SuppressWarnings("unchecked")
    public Mono<Void> loadRulesIfMissing(String profileId) {
        String baseKey = PROFILE_KEY + profileId;
        Duration ttl = Duration.ofSeconds(dnsProperties.getRulesTtlSeconds());

        return redisTemplate.hasKey(baseKey + ":level")
            .flatMap(exists -> {
                if (Boolean.TRUE.equals(exists)) return Mono.empty();
                return Mono.fromCallable(() -> dnsRulesClient.getRulesForProfile(profileId))
                    .subscribeOn(Schedulers.boundedElastic())
                    .flatMap(response -> {
                        // Unwrap ApiResponse wrapper: {success:true, data:{...}, timestamp:...}
                        Object dataObj = response.get("data");
                        Map<String, Object> rules = dataObj instanceof Map
                            ? (Map<String, Object>) dataObj : response;

                        Mono<Void> ops = Mono.empty();

                        // Filter level — derived from enabledCategories or filterLevel field
                        String level = rules.containsKey("filterLevel")
                            ? String.valueOf(rules.get("filterLevel"))
                            : "moderate";
                        ops = ops.then(redisTemplate.opsForValue().set(baseKey + ":level", level.toLowerCase(), ttl).then());

                        // Custom blocklist
                        Object blocklist = rules.get("customBlocklist");
                        if (blocklist instanceof List<?> list && !list.isEmpty()) {
                            String[] domains = list.stream().map(Object::toString).toArray(String[]::new);
                            ops = ops.then(redisTemplate.opsForSet().add(baseKey + ":blocklist", domains)
                                .then(redisTemplate.expire(baseKey + ":blocklist", ttl)).then());
                        }

                        // Custom allowlist
                        Object allowlist = rules.get("customAllowlist");
                        if (allowlist instanceof List<?> list && !list.isEmpty()) {
                            String[] domains = list.stream().map(Object::toString).toArray(String[]::new);
                            ops = ops.then(redisTemplate.opsForSet().add(baseKey + ":allowlist", domains)
                                .then(redisTemplate.expire(baseKey + ":allowlist", ttl)).then());
                        }

                        // Category overrides — API returns enabledCategories where false=blocked
                        // Load per-category overrides for non-default blocking decisions
                        Object enabledCats = rules.get("enabledCategories");
                        if (enabledCats instanceof Map<?, ?> catMap && !catMap.isEmpty()) {
                            for (Map.Entry<?, ?> e : catMap.entrySet()) {
                                String key = e.getKey().toString();
                                // Skip internal flags
                                if (key.startsWith("__")) continue;
                                Object val = e.getValue();
                                // false = blocked, true = allowed
                                boolean enabled = !Boolean.FALSE.equals(val);
                                ops = ops.then(redisTemplate.opsForHash()
                                    .put(baseKey + ":categories", key, enabled ? "allowed" : "blocked")
                                    .then());
                            }
                            ops = ops.then(redisTemplate.expire(baseKey + ":categories", ttl).then());
                        }

                        // Schedule
                        Object schedule = rules.get("schedule");
                        if (schedule instanceof String s && !s.isEmpty()) {
                            ops = ops.then(redisTemplate.opsForValue().set(baseKey + ":schedule", s, ttl).then());
                        }

                        return ops;
                    });
            })
            .then();
    }

    @SuppressWarnings("unchecked")
    private Mono<String> loadProfileIdFromService(String dnsClientId) {
        return Mono.fromCallable(() -> dnsRulesClient.resolveClientId(dnsClientId))
            .subscribeOn(Schedulers.boundedElastic())
            .flatMap(response -> {
                // Response is ApiResponse wrapped: {success:true, data:{profileId:..., tenantId:...}}
                Object dataObj = response.get("data");
                Map<String, Object> data = dataObj instanceof Map ? (Map<String, Object>) dataObj : response;
                String profileId = data.get("profileId") != null ? data.get("profileId").toString() : null;
                if (profileId == null) return Mono.empty();
                Duration ttl = Duration.ofSeconds(dnsProperties.getRulesTtlSeconds());
                return redisTemplate.opsForValue()
                    .set(CLIENT_KEY + dnsClientId, profileId, ttl)
                    .thenReturn(profileId);
            });
    }
}
