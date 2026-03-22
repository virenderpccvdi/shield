package com.rstglobal.shield.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Sends a monthly PDF-style report card email to parents on the 1st of each month.
 * <p>
 * For each CUSTOMER user, fetches child profiles from shield-profile, monthly DNS
 * stats from shield-analytics, and dispatches one report-card email per child via
 * {@link EmailService#sendReportCard}.
 * <p>
 * All inter-service calls are wrapped in try/catch — failures must never propagate
 * to the scheduler thread.
 */
@Slf4j
@Service
public class ReportCardService {

    private static final String ANALYTICS_SERVICE = "SHIELD-ANALYTICS";
    private static final String PROFILE_SERVICE   = "SHIELD-PROFILE";
    private static final String AUTH_SERVICE      = "SHIELD-AUTH";

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMMM yyyy");

    // -------------------------------------------------------
    //  Inner DTO — per-child monthly report data
    // -------------------------------------------------------

    /**
     * Immutable snapshot of one child's activity for the monthly report card email.
     *
     * @param childName       display name of the child profile
     * @param monthYear       human-readable month, e.g. "February 2026"
     * @param totalQueries    total DNS queries resolved by Shield during the month
     * @param blockedQueries  queries that were blocked
     * @param blockRate       percentage of queries blocked (0.0–100.0)
     * @param topCategories   top 3 blocked content categories
     * @param topDomains      top 5 blocked domains
     * @param sosEvents       number of SOS / panic alerts triggered
     * @param geofenceBreaches number of geofence boundary violations
     * @param grade           safety grade: "A", "B", "C", or "D"
     */
    public record ReportCardData(
            String childName,
            String monthYear,
            long totalQueries,
            long blockedQueries,
            double blockRate,
            List<String> topCategories,
            List<String> topDomains,
            int sosEvents,
            int geofenceBreaches,
            String grade
    ) {}

    // -------------------------------------------------------
    //  Dependencies
    // -------------------------------------------------------

    private final EmailService    emailService;
    private final DiscoveryClient discoveryClient;
    private final RestClient      restClient;

    public ReportCardService(EmailService emailService, DiscoveryClient discoveryClient) {
        this.emailService    = emailService;
        this.discoveryClient = discoveryClient;
        this.restClient      = RestClient.builder().build();
    }

    // -------------------------------------------------------
    //  Scheduler entry point — 1st of each month at 09:00
    // -------------------------------------------------------

    /**
     * Runs on the 1st of every month at 09:00 server time.
     * Sends one report card per child for each active CUSTOMER user.
     */
    @Scheduled(cron = "0 0 9 1 * *")
    public void sendMonthlyReportCards() {
        log.info("Monthly report card job started");

        List<Map<String, Object>> customers = fetchCustomerUsers();
        if (customers.isEmpty()) {
            log.info("No active CUSTOMER users found — skipping monthly report cards");
            return;
        }

        int dispatched = 0;
        for (Map<String, Object> user : customers) {
            try {
                String userId     = String.valueOf(user.get("id"));
                String email      = String.valueOf(user.get("email"));
                String parentName = deriveParentName(user);
                sendReportCardForUser(userId, email, parentName);
                dispatched++;
            } catch (Exception e) {
                log.warn("Failed to dispatch report card for user {}: {}",
                        user.get("id"), e.getMessage());
            }
        }

        log.info("Monthly report card job complete: dispatched for {}/{} users",
                dispatched, customers.size());
    }

    // -------------------------------------------------------
    //  Per-user report card (manual trigger + scheduler)
    // -------------------------------------------------------

    /**
     * Builds and sends one report card email per child profile for the given parent.
     * Safe to call directly for testing via the trigger endpoint.
     *
     * @param userId     the parent user's UUID string
     * @param email      the parent's email address
     * @param parentName display name used in the greeting
     */
    public void sendReportCardForUser(String userId, String email, String parentName) {
        // Report covers the previous calendar month
        LocalDate today     = LocalDate.now();
        LocalDate firstOfThisMonth = today.withDayOfMonth(1);
        LocalDate monthStart = firstOfThisMonth.minusMonths(1);
        LocalDate monthEnd   = firstOfThisMonth.minusDays(1);
        String monthYear = monthStart.format(MONTH_FMT);

        List<Map<String, Object>> profiles = fetchChildProfiles(userId);

        if (profiles.isEmpty()) {
            log.debug("No child profiles for user {} — skipping report card", userId);
            return;
        }

        int sent = 0;
        for (Map<String, Object> profile : profiles) {
            try {
                String profileId = String.valueOf(profile.get("id"));
                String childName = getStr(profile, "name", "Child");

                // Monthly analytics stats
                Map<String, Object> analyticsStats =
                        fetchMonthlyAnalytics(userId, profileId, monthStart, monthEnd);

                long totalQueries    = toLong(analyticsStats.get("totalQueries"));
                long blockedQueries  = toLong(analyticsStats.get("blockedQueries"));
                double blockRate     = totalQueries > 0
                        ? (blockedQueries * 100.0 / totalQueries)
                        : 0.0;

                @SuppressWarnings("unchecked")
                List<String> topCategories = (List<String>) analyticsStats
                        .getOrDefault("topBlockedCategories", List.of());

                @SuppressWarnings("unchecked")
                List<String> topDomains = (List<String>) analyticsStats
                        .getOrDefault("topBlockedDomains", List.of());

                int sosEvents        = toInt(analyticsStats.get("sosAlerts"));
                int geofenceBreaches = toInt(analyticsStats.get("geofenceBreaches"));

                String grade = computeGrade(blockRate);

                ReportCardData data = new ReportCardData(
                        childName,
                        monthYear,
                        totalQueries,
                        blockedQueries,
                        blockRate,
                        topCategories.stream().limit(3).collect(Collectors.toList()),
                        topDomains.stream().limit(5).collect(Collectors.toList()),
                        sosEvents,
                        geofenceBreaches,
                        grade
                );

                String subject = "Shield Report Card — " + childName + " (" + monthYear + ")";
                String html    = buildMonthlyHtml(parentName, childName, data);

                boolean ok = emailService.sendReportCard(email, parentName, subject, html);
                if (ok) sent++;

            } catch (Exception e) {
                log.warn("Report card failed for profile {} (user {}): {}",
                        profile.get("id"), userId, e.getMessage());
            }
        }

        log.debug("Monthly report card for user {}: {} of {} child emails sent",
                userId, sent, profiles.size());
    }

    // -------------------------------------------------------
    //  HTML builder
    // -------------------------------------------------------

    private String buildMonthlyHtml(String parentName, String childName, ReportCardData data) {
        String gradeColor = switch (data.grade()) {
            case "A" -> "#2e7d32";
            case "B" -> "#1565c0";
            case "C" -> "#e65100";
            default  -> "#c62828";
        };

        String html = "<html><body style='font-family:Arial,sans-serif;max-width:650px;margin:auto;background:#f5f5f5'>" +
            "<div style='background:linear-gradient(135deg,#1976D2,#1565C0);padding:32px;color:white;text-align:center'>" +
            "<h1 style='margin:0;font-size:28px'>&#127737; Shield Report Card</h1>" +
            "<p style='margin:8px 0 0;opacity:0.85'>" + data.monthYear() + "</p></div>" +
            "<div style='background:white;padding:32px'>" +
            "<p style='font-size:15px;color:#333;margin:0 0 20px'>Hi <b>" + parentName + "</b>,<br/>" +
            "Here&rsquo;s " + childName + "&rsquo;s internet safety report card for <b>" + data.monthYear() + "</b>.</p>" +
            "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:24px'>" +
            "<div><h2 style='margin:0'>" + data.childName() + "</h2>" +
            "<p style='color:#666;margin:4px 0 0'>Monthly Internet Safety Report</p></div>" +
            "<div style='width:72px;height:72px;border-radius:50%;background:" + gradeColor +
            ";display:flex;align-items:center;justify-content:center;" +
            "color:white;font-size:32px;font-weight:900'>" + data.grade() + "</div>" +
            "</div>" +
            "<table style='width:100%;border-collapse:collapse;margin-bottom:24px'>" +
            "<tr style='background:#f5f5f5'>" +
            "<td style='padding:12px;border:1px solid #e0e0e0;font-weight:700'>Metric</td>" +
            "<td style='padding:12px;border:1px solid #e0e0e0;font-weight:700'>Value</td></tr>" +
            "<tr><td style='padding:12px;border:1px solid #e0e0e0'>Total DNS Queries</td>" +
            "<td style='padding:12px;border:1px solid #e0e0e0'>" + data.totalQueries() + "</td></tr>" +
            "<tr style='background:#fce4ec'>" +
            "<td style='padding:12px;border:1px solid #e0e0e0'>Blocked</td>" +
            "<td style='padding:12px;border:1px solid #e0e0e0;color:#c62828;font-weight:700'>" +
            data.blockedQueries() + " (" + String.format("%.0f", data.blockRate()) + "%)</td></tr>" +
            "<tr><td style='padding:12px;border:1px solid #e0e0e0'>SOS Alerts</td>" +
            "<td style='padding:12px;border:1px solid #e0e0e0'>" + data.sosEvents() + "</td></tr>" +
            "<tr><td style='padding:12px;border:1px solid #e0e0e0'>Geofence Breaches</td>" +
            "<td style='padding:12px;border:1px solid #e0e0e0'>" + data.geofenceBreaches() + "</td></tr>" +
            "</table>" +
            (data.topDomains().isEmpty() ? "" :
                "<h3 style='color:#1976D2'>Top Blocked Domains</h3>" +
                "<ul style='padding-left:20px'>" +
                data.topDomains().stream()
                        .map(d -> "<li style='margin:4px 0'>" + d + "</li>")
                        .collect(Collectors.joining()) +
                "</ul>") +
            "<div style='text-align:center;margin:28px 0 8px'>" +
            "<a href='https://shield.rstglobal.in/app/analytics' " +
            "style='display:inline-block;background:linear-gradient(135deg,#1565C0,#42A5F5);" +
            "color:#fff;text-decoration:none;padding:13px 34px;border-radius:8px;" +
            "font-weight:700;font-size:14px'>View Full Report</a>" +
            "</div>" +
            "<p style='color:#888;font-size:12px;margin-top:32px;border-top:1px solid #eee;" +
            "padding-top:16px'>Sent by Shield &mdash; Family Internet Protection " +
            "&#169; " + Year.now() + "</p>" +
            "</div></body></html>";

        return html;
    }

    // -------------------------------------------------------
    //  Grade logic
    // -------------------------------------------------------

    /** A = > 80%, B = 60–80%, C = 40–60%, D = < 40% */
    private String computeGrade(double blockRate) {
        if (blockRate > 80.0) return "A";
        if (blockRate > 60.0) return "B";
        if (blockRate > 40.0) return "C";
        return "D";
    }

    // -------------------------------------------------------
    //  Service discovery + REST calls
    // -------------------------------------------------------

    /**
     * Fetch all active CUSTOMER users from shield-auth (up to 500).
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchCustomerUsers() {
        try {
            String baseUrl = resolveService(AUTH_SERVICE);
            if (baseUrl == null) return List.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/auth/users?role=CUSTOMER&page=0&size=500")
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
     * Fetch monthly analytics for a single child profile from shield-analytics.
     * Expected response shape:
     * {@code { data: { totalQueries, blockedQueries, topBlockedCategories: [...],
     *                  topBlockedDomains: [...], sosAlerts, geofenceBreaches } }}
     * Falls back gracefully to zeros/empty lists if unavailable.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchMonthlyAnalytics(String userId, String profileId,
                                                        LocalDate monthStart, LocalDate monthEnd) {
        try {
            String baseUrl = resolveService(ANALYTICS_SERVICE);
            if (baseUrl == null) return Map.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/api/v1/analytics/profiles/" + profileId
                            + "/monthly?from=" + monthStart + "&to=" + monthEnd)
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
            log.debug("Monthly analytics unavailable for profile {}: {}", profileId, e.getMessage());
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
