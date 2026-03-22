package com.rstglobal.shield.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Sends a weekly email digest every Monday at 8 AM to all active CUSTOMER users.
 * <p>
 * For each customer, fetches child profiles from shield-profile, per-profile DNS
 * query stats from shield-dns, safety events from shield-analytics, and sends one
 * email per child using {@link EmailService#sendWeeklyDigest}.
 * <p>
 * All inter-service calls are wrapped in try/catch — digest failures must never
 * propagate to the scheduler thread.
 */
@Slf4j
@Service
public class WeeklyDigestService {

    private static final String ANALYTICS_SERVICE = "SHIELD-ANALYTICS";
    private static final String PROFILE_SERVICE   = "SHIELD-PROFILE";
    private static final String AUTH_SERVICE      = "SHIELD-AUTH";
    private static final String DNS_SERVICE       = "SHIELD-DNS";

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM d, yyyy");

    // -------------------------------------------------------
    //  Inner DTO — per-child digest data
    // -------------------------------------------------------

    /**
     * Immutable snapshot of one child's activity for the digest email.
     *
     * @param childName               display name of the child profile
     * @param totalQueriesThisWeek    total DNS queries resolved by Shield
     * @param blockedThisWeek         queries that were blocked
     * @param allowedThisWeek         queries that were allowed
     * @param topBlockedDomains       up to 5 most-blocked domains
     * @param sosAlertsThisWeek       number of SOS / panic alerts triggered
     * @param geofenceBreachesThisWeek number of geofence boundary violations
     * @param weekStart               human-readable start date, e.g. "Mar 15, 2026"
     * @param weekEnd                 human-readable end date,   e.g. "Mar 21, 2026"
     */
    public record WeeklyDigestData(
            String childName,
            long totalQueriesThisWeek,
            long blockedThisWeek,
            long allowedThisWeek,
            List<String> topBlockedDomains,
            int sosAlertsThisWeek,
            int geofenceBreachesThisWeek,
            String weekStart,
            String weekEnd
    ) {}

    // -------------------------------------------------------
    //  Dependencies
    // -------------------------------------------------------

    private final EmailService    emailService;
    private final DiscoveryClient discoveryClient;
    private final RestClient      restClient;

    public WeeklyDigestService(EmailService emailService, DiscoveryClient discoveryClient) {
        this.emailService    = emailService;
        this.discoveryClient = discoveryClient;
        this.restClient      = RestClient.builder().build();
    }

    // -------------------------------------------------------
    //  Scheduler entry point
    // -------------------------------------------------------

    /**
     * Runs every Monday at 08:00 server time.
     * Each user's digest is sent asynchronously to avoid blocking the scheduler thread.
     */
    @Scheduled(cron = "0 0 8 * * MON")
    public void sendWeeklyDigests() {
        log.info("Weekly digest job started");

        List<Map<String, Object>> customers = fetchCustomerUsers();
        if (customers.isEmpty()) {
            log.info("No active CUSTOMER users found — skipping weekly digest");
            return;
        }

        LocalDate weekEnd   = LocalDate.now().minusDays(1); // Sunday
        LocalDate weekStart = weekEnd.minusDays(6);         // Previous Monday

        int dispatched = 0;
        for (Map<String, Object> user : customers) {
            try {
                sendDigestForUser(user, weekStart, weekEnd);
                dispatched++;
            } catch (Exception e) {
                log.warn("Failed to dispatch digest for user {}: {}",
                        user.get("id"), e.getMessage());
            }
        }

        log.info("Weekly digest job complete: dispatched for {}/{} users", dispatched, customers.size());
    }

    // -------------------------------------------------------
    //  Per-user digest (called async + from manual trigger)
    // -------------------------------------------------------

    /**
     * Builds and sends one digest email per child profile for the given parent.
     * Safe to call directly for testing via the trigger endpoint.
     *
     * @param user      map with keys: id, email, tenantId (optional)
     * @param weekStart first day of the reporting window (Monday)
     * @param weekEnd   last day of the reporting window (Sunday)
     */
    @Async
    public void sendDigestForUser(Map<String, Object> user,
                                   LocalDate weekStart, LocalDate weekEnd) {
        String userId = String.valueOf(user.get("id"));
        String email  = String.valueOf(user.get("email"));

        String parentName = deriveParentName(user);
        String startLabel = weekStart.format(DATE_FMT);
        String endLabel   = weekEnd.format(DATE_FMT);

        List<Map<String, Object>> profiles = fetchChildProfiles(userId);

        if (profiles.isEmpty()) {
            // No children — send a simple "visit dashboard" digest
            WeeklyDigestData data = new WeeklyDigestData(
                    "your family",
                    0, 0, 0,
                    List.of(),
                    0, 0,
                    startLabel, endLabel
            );
            emailService.sendWeeklyDigest(email, parentName, data);
            return;
        }

        // Send one digest per child profile
        int sent = 0;
        for (Map<String, Object> profile : profiles) {
            try {
                String profileId = String.valueOf(profile.get("id"));
                String childName = getStr(profile, "name", "Child");

                // DNS stats for this profile
                Map<String, Object> dnsStats = fetchDnsStats(profileId, weekStart, weekEnd);

                // Safety events (SOS + geofence) from analytics
                Map<String, Object> safetyStats = fetchSafetyStats(userId, profileId, weekStart, weekEnd);

                long totalQueries = toLong(dnsStats.get("totalQueries"));
                long blocked      = toLong(dnsStats.get("blocked"));
                long allowed      = totalQueries - blocked;

                @SuppressWarnings("unchecked")
                List<String> topBlocked = (List<String>) dnsStats.getOrDefault("topBlockedDomains", List.of());

                int sosAlerts       = toInt(safetyStats.get("sosAlerts"));
                int geofenceBreaches = toInt(safetyStats.get("geofenceBreaches"));

                WeeklyDigestData data = new WeeklyDigestData(
                        childName,
                        totalQueries,
                        blocked,
                        Math.max(0, allowed),
                        topBlocked.stream().limit(5).collect(Collectors.toList()),
                        sosAlerts,
                        geofenceBreaches,
                        startLabel,
                        endLabel
                );

                boolean ok = emailService.sendWeeklyDigest(email, parentName, data);
                if (ok) sent++;

            } catch (Exception e) {
                log.warn("Digest failed for profile {} (user {}): {}", profile.get("id"), userId, e.getMessage());
            }
        }

        log.debug("Weekly digest for user {}: {} of {} child emails sent", userId, sent, profiles.size());
    }

    // -------------------------------------------------------
    //  Service discovery + REST calls
    // -------------------------------------------------------

    /**
     * Fetch all active CUSTOMER users from shield-auth (paginated, up to 1000).
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchCustomerUsers() {
        try {
            String baseUrl = resolveService(AUTH_SERVICE);
            if (baseUrl == null) return List.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/auth/users?role=CUSTOMER&page=0&size=1000")
                    .header("X-User-Role",     "GLOBAL_ADMIN")
                    .header("X-Internal-Call", "true")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response == null) return List.of();

            Object data = response.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object content = dataMap.get("content");
                if (content instanceof List<?> list) {
                    return (List<Map<String, Object>>) list;
                }
            }
            if (data instanceof List<?> list) {
                return (List<Map<String, Object>>) list;
            }
            return List.of();
        } catch (Exception e) {
            log.warn("Failed to fetch customer users from {}: {}", AUTH_SERVICE, e.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch child profiles for a parent user from shield-profile.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchChildProfiles(String userId) {
        try {
            String baseUrl = resolveService(PROFILE_SERVICE);
            if (baseUrl == null) return List.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/profiles/my")
                    .header("X-User-Id",   userId)
                    .header("X-User-Role", "CUSTOMER")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response == null) return List.of();
            Object data = response.get("data");
            if (data instanceof List<?> list) {
                return (List<Map<String, Object>>) list;
            }
            return List.of();
        } catch (Exception e) {
            log.warn("Failed to fetch profiles for user {}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch DNS query statistics for a single child profile from shield-dns.
     * Expected response shape: {@code { data: { totalQueries, blocked, topBlockedDomains: [...] } }}
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchDnsStats(String profileId,
                                               LocalDate weekStart, LocalDate weekEnd) {
        try {
            String baseUrl = resolveService(DNS_SERVICE);
            if (baseUrl == null) return Map.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/dns/stats/profile/" + profileId
                            + "?from=" + weekStart + "&to=" + weekEnd)
                    .header("X-Internal-Call", "true")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response == null) return Map.of();
            Object data = response.get("data");
            if (data instanceof Map<?, ?> map) {
                return (Map<String, Object>) map;
            }
            return Map.of();
        } catch (Exception e) {
            log.debug("DNS stats unavailable for profile {}: {}", profileId, e.getMessage());
            return Map.of();
        }
    }

    /**
     * Fetch safety event counts (SOS alerts, geofence breaches) for a child profile
     * from shield-analytics.  Falls back to zeros if the service is unavailable.
     * Expected response: {@code { data: { sosAlerts, geofenceBreaches } }}
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchSafetyStats(String userId, String profileId,
                                                   LocalDate weekStart, LocalDate weekEnd) {
        try {
            String baseUrl = resolveService(ANALYTICS_SERVICE);
            if (baseUrl == null) return Map.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/analytics/profiles/" + profileId
                            + "/weekly?from=" + weekStart + "&to=" + weekEnd)
                    .header("X-User-Id",   userId)
                    .header("X-User-Role", "CUSTOMER")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response == null) return Map.of();
            Object data = response.get("data");
            if (data instanceof Map<?, ?> map) {
                return (Map<String, Object>) map;
            }
            return Map.of();
        } catch (Exception e) {
            log.debug("Safety stats unavailable for profile {}: {}", profileId, e.getMessage());
            return Map.of();
        }
    }

    // -------------------------------------------------------
    //  Utilities
    // -------------------------------------------------------

    private String resolveService(String serviceId) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceId);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", serviceId);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    /** Derive a friendly first name from available user map fields. */
    private String deriveParentName(Map<String, Object> user) {
        String firstName = getStr(user, "firstName", null);
        if (firstName != null) return firstName;
        String name = getStr(user, "name", null);
        if (name != null) {
            String[] parts = name.split("\\s+", 2);
            return parts[0];
        }
        String email = getStr(user, "email", "there");
        int atIdx = email.indexOf('@');
        return atIdx > 0 ? email.substring(0, atIdx) : "there";
    }

    private String getStr(Map<String, Object> map, String key, String fallback) {
        Object val = map.get(key);
        return (val != null && !String.valueOf(val).isBlank()) ? String.valueOf(val) : fallback;
    }

    private long toLong(Object val) {
        if (val == null) return 0L;
        if (val instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(val)); } catch (NumberFormatException e) { return 0L; }
    }

    private int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(val)); } catch (NumberFormatException e) { return 0; }
    }
}
