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

/**
 * Sends a weekly email digest every Monday at 8 AM to all active CUSTOMER users.
 * <p>
 * Fetches analytics data from shield-analytics and child profiles from shield-profile
 * via Eureka-resolved internal calls, then renders the weekly-digest template
 * and sends via {@link EmailService}.
 */
@Slf4j
@Service
public class WeeklyDigestService {

    private static final String ANALYTICS_SERVICE = "SHIELD-ANALYTICS";
    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";
    private static final String AUTH_SERVICE = "SHIELD-AUTH";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final String DASHBOARD_URL = "https://shield.rstglobal.in/app/analytics";

    private final EmailService emailService;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public WeeklyDigestService(EmailService emailService, DiscoveryClient discoveryClient) {
        this.emailService = emailService;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Runs every Monday at 8:00 AM server time.
     * Each user digest is sent asynchronously to avoid blocking the scheduler.
     */
    @Scheduled(cron = "0 0 8 * * MON")
    public void sendWeeklyDigests() {
        log.info("Weekly digest job started");

        List<Map<String, Object>> customers = fetchCustomerUsers();
        if (customers.isEmpty()) {
            log.info("No active CUSTOMER users found — skipping weekly digest");
            return;
        }

        LocalDate weekEnd = LocalDate.now().minusDays(1); // Sunday
        LocalDate weekStart = weekEnd.minusDays(6);       // Previous Monday
        String dateRange = weekStart.format(DATE_FMT) + " - " + weekEnd.format(DATE_FMT);

        int sent = 0;
        for (Map<String, Object> user : customers) {
            try {
                sendDigestForUser(user, dateRange, weekStart, weekEnd);
                sent++;
            } catch (Exception e) {
                log.warn("Failed to send weekly digest for user {}: {}",
                        user.get("id"), e.getMessage());
            }
        }

        log.info("Weekly digest job complete: sent {}/{} digests", sent, customers.size());
    }

    @Async
    public void sendDigestForUser(Map<String, Object> user, String dateRange,
                                   LocalDate weekStart, LocalDate weekEnd) {
        String userId = String.valueOf(user.get("id"));
        String email = String.valueOf(user.get("email"));
        String tenantIdStr = user.get("tenantId") != null ? String.valueOf(user.get("tenantId")) : null;
        UUID tenantId = tenantIdStr != null ? UUID.fromString(tenantIdStr) : null;

        // Fetch child profiles for this user
        List<Map<String, Object>> profiles = fetchChildProfiles(userId);

        // Fetch weekly analytics (platform overview as fallback)
        Map<String, Object> analytics = fetchWeeklyAnalytics(userId, weekStart, weekEnd);

        // Build template variables
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("dateRange", dateRange);
        vars.put("dashboardUrl", DASHBOARD_URL);

        // Summary stats
        vars.put("totalScreenTime", getOrDefault(analytics, "totalScreenTime", "0h 0m"));
        vars.put("blockedAttempts", getOrDefault(analytics, "blockedAttempts", "0"));
        vars.put("childCount", String.valueOf(profiles.size()));
        vars.put("geofenceAlerts", getOrDefault(analytics, "geofenceAlerts", "0"));

        // Children breakdown
        List<Map<String, Object>> childrenData = new ArrayList<>();
        for (Map<String, Object> profile : profiles) {
            Map<String, Object> child = new LinkedHashMap<>();
            child.put("name", getOrDefault(profile, "name", "Child"));
            child.put("screenTime", getOrDefault(profile, "screenTime", "N/A"));
            child.put("blocked", getOrDefault(profile, "blocked", "0"));
            child.put("topApp", getOrDefault(profile, "topApp", "N/A"));
            childrenData.add(child);
        }
        vars.put("children", childrenData);

        // Top sites
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topSites = (List<Map<String, Object>>) analytics.getOrDefault("topSites", List.of());
        if (topSites.isEmpty()) {
            // Provide placeholder data when analytics aren't available yet
            topSites = List.of(
                    Map.of("domain", "No data yet", "visits", 0)
            );
        }
        vars.put("topSites", topSites);

        // AI Insights
        @SuppressWarnings("unchecked")
        List<String> insights = (List<String>) analytics.getOrDefault("insights", List.of());
        vars.put("insights", insights);

        // Send email
        boolean success = emailService.sendEmail(tenantId, email,
                "Shield Weekly Digest - " + dateRange,
                "weekly-digest", vars);

        if (success) {
            log.debug("Weekly digest sent to {}", email);
        }
    }

    // -------------------------------------------------------
    //  Service discovery + REST calls
    // -------------------------------------------------------

    /**
     * Fetch all active CUSTOMER users from shield-auth.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchCustomerUsers() {
        try {
            String baseUrl = resolveService(AUTH_SERVICE);
            if (baseUrl == null) return List.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/auth/users?role=CUSTOMER&page=0&size=1000")
                    .header("X-User-Role", "GLOBAL_ADMIN")
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
                    .header("X-User-Id", userId)
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
     * Fetch weekly analytics summary from shield-analytics.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchWeeklyAnalytics(String userId,
                                                      LocalDate weekStart, LocalDate weekEnd) {
        try {
            String baseUrl = resolveService(ANALYTICS_SERVICE);
            if (baseUrl == null) return Map.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/analytics/platform/overview?from=" + weekStart + "&to=" + weekEnd)
                    .header("X-User-Id", userId)
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
            log.warn("Failed to fetch analytics for user {}: {}", userId, e.getMessage());
            return Map.of();
        }
    }

    private String resolveService(String serviceId) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceId);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", serviceId);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private String getOrDefault(Map<String, Object> map, String key, String fallback) {
        Object val = map.get(key);
        return val != null ? String.valueOf(val) : fallback;
    }
}
