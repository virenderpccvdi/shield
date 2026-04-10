package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.admin.repository.BulkImportJobRepository;
import com.rstglobal.shield.admin.repository.ComplianceReportRepository;
import com.rstglobal.shield.admin.repository.IspBrandingRepository;
import com.rstglobal.shield.admin.repository.Tr069ProvisionRepository;
import com.rstglobal.shield.admin.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "Platform Admin", description = "Platform-wide statistics, revenue, service health and lifecycle management (GLOBAL_ADMIN only)")
@RestController
@RequestMapping("/api/v1/admin/platform")
@RequiredArgsConstructor
@Slf4j
public class PlatformController {

    private final IspBrandingRepository brandingRepository;
    private final Tr069ProvisionRepository provisionRepository;
    private final BulkImportJobRepository importJobRepository;
    private final ComplianceReportRepository complianceReportRepository;
    private final AuditLogService auditLogService;
    private final EntityManager entityManager;

    private static final Set<String> ALLOWED_SERVICES = Set.of(
            "eureka", "gateway", "auth", "tenant", "profile",
            "dns", "location", "notification", "rewards", "analytics", "admin", "ai"
    );

    /** K8s service-name → health check port */
    private static final Map<String, Integer> SERVICE_PORTS = Map.ofEntries(
            Map.entry("eureka", 8261),
            Map.entry("gateway", 8280),
            Map.entry("auth", 8281),
            Map.entry("tenant", 8282),
            Map.entry("profile", 8283),
            Map.entry("dns", 8284),
            Map.entry("location", 8285),
            Map.entry("notification", 8286),
            Map.entry("rewards", 8287),
            Map.entry("analytics", 8289),
            Map.entry("admin", 8290),
            Map.entry("ai", 8291)
    );

    @Operation(summary = "Platform stats", description = "Returns counts of tenants, customers, users, devices, subscriptions and provisioned items across the whole platform.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Stats returned"),
        @ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> platformStats(@RequestHeader("X-User-Role") String role) {
        requireGlobalAdmin(role);
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("timestamp", OffsetDateTime.now().toString());
        stats.put("totalIspTenants", queryCount("SELECT count(*) FROM tenant.tenants WHERE is_active = true AND deleted_at IS NULL"));
        stats.put("totalCustomers", queryCount("SELECT count(*) FROM profile.customers"));
        stats.put("activeProfiles", queryCount("SELECT count(*) FROM profile.child_profiles"));
        stats.put("totalUsers", queryCount("SELECT count(*) FROM auth.users WHERE is_active = true AND deleted_at IS NULL"));
        stats.put("totalDevices", queryCount("SELECT count(*) FROM profile.devices"));
        stats.put("totalProvisionedDevices", provisionRepository.count());
        stats.put("totalBulkImportJobs", importJobRepository.count());
        stats.put("totalComplianceReports", complianceReportRepository.count());
        stats.put("activeSubscriptions", queryCount("SELECT count(*) FROM profile.customers WHERE subscription_status = 'ACTIVE'"));
        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Revenue stats", description = "Returns monthly recurring revenue (MRR), active subscription count, and active plan count.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Revenue stats returned"),
        @ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    @GetMapping("/revenue")
    public ResponseEntity<Map<String, Object>> revenueStats(@RequestHeader("X-User-Role") String role) {
        requireGlobalAdmin(role);
        Map<String, Object> revenue = new LinkedHashMap<>();
        // Calculate MRR: join customers with subscription plans
        try {
            Object result = entityManager.createNativeQuery(
                "SELECT COALESCE(SUM(sp.price), 0) FROM profile.customers c " +
                "JOIN admin.subscription_plans sp ON LOWER(c.subscription_plan) = LOWER(sp.name) " +
                "WHERE c.subscription_status = 'ACTIVE' AND sp.active = true"
            ).getSingleResult();
            revenue.put("monthlyRevenue", ((Number) result).doubleValue());
        } catch (Exception e) {
            log.warn("Failed revenue query", e);
            revenue.put("monthlyRevenue", 0);
        }
        revenue.put("activeSubscriptions", queryCount("SELECT count(*) FROM profile.customers WHERE subscription_status = 'ACTIVE'"));
        revenue.put("totalPlans", queryCount("SELECT count(*) FROM admin.subscription_plans WHERE active = true"));
        return ResponseEntity.ok(revenue);
    }

    private long queryCount(String sql) {
        try {
            Object result = entityManager.createNativeQuery(sql).getSingleResult();
            return ((Number) result).longValue();
        } catch (Exception e) {
            log.warn("Failed cross-schema query: {}", sql, e);
            return 0;
        }
    }

    @Operation(summary = "Platform health (quick)", description = "Returns admin service status, database connectivity, and a live HTTP health check for every Shield microservice.")
    @ApiResponse(responseCode = "200", description = "Health report returned")
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> platformHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("timestamp", OffsetDateTime.now().toString());
        health.put("adminService", "UP");
        try {
            brandingRepository.count();
            health.put("database", "UP");
        } catch (Exception e) {
            health.put("database", "DOWN");
            health.put("databaseError", e.getMessage());
        }
        // Build live service status
        Map<String, String> serviceStatus = new LinkedHashMap<>();
        for (String svc : ALLOWED_SERVICES) {
            serviceStatus.put("shield-" + svc, getServiceStatus(svc));
        }
        health.put("services", serviceStatus);
        return ResponseEntity.ok(health);
    }

    // ── A8: GET /api/v1/admin/system/health — aggregated services health ──────

    /**
     * A8: GET /api/v1/admin/system/health
     * Calls each service's /actuator/health in parallel using CompletableFuture.
     * Returns: { "overall": "UP|DOWN", "services": { "gateway": "UP", "auth": "UP", ... },
     *            "timestamp": "...", "upCount": 10, "downCount": 1 }
     * Also accessible as GET /api/v1/admin/platform/system/health (same method).
     */
    @Operation(summary = "Aggregated system health", description = "Checks all microservices in parallel via /actuator/health and returns overall UP/DEGRADED/DOWN status with per-service results.")
    @ApiResponse(responseCode = "200", description = "Aggregated health report returned")
    @GetMapping("/system/health")
    public ResponseEntity<Map<String, Object>> systemHealth() {
        List<java.util.concurrent.CompletableFuture<Map.Entry<String, String>>> futures = new ArrayList<>();

        for (String svc : ALLOWED_SERVICES) {
            futures.add(java.util.concurrent.CompletableFuture.supplyAsync(() ->
                    Map.entry(svc, getServiceStatus(svc))
            ));
        }

        // Wait for all health checks (each has 3 s timeout inside getServiceStatus)
        java.util.concurrent.CompletableFuture.allOf(futures.toArray(new java.util.concurrent.CompletableFuture[0])).join();

        Map<String, String> services = new LinkedHashMap<>();
        long upCount   = 0;
        long downCount = 0;
        for (var future : futures) {
            try {
                Map.Entry<String, String> e = future.get();
                services.put(e.getKey(), e.getValue());
                if ("active".equals(e.getValue())) upCount++;
                else downCount++;
            } catch (Exception ex) {
                log.warn("Could not get health status: {}", ex.getMessage());
            }
        }

        String overall = downCount == 0 ? "UP" : (upCount == 0 ? "DOWN" : "DEGRADED");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("overall",   overall);
        result.put("timestamp", OffsetDateTime.now().toString());
        result.put("upCount",   upCount);
        result.put("downCount", downCount);
        result.put("services",  services);
        return ResponseEntity.ok(result);
    }

    /** GET /api/v1/admin/platform/services — status of all services via HTTP health checks */
    @Operation(summary = "List all services with status", description = "Returns a sorted list of all Shield microservices with their current HTTP health check status.")
    @ApiResponse(responseCode = "200", description = "Service list returned")
    @GetMapping("/services")
    public ResponseEntity<List<Map<String, Object>>> listServices() {
        List<Map<String, Object>> result = new ArrayList<>();
        List<String> sorted = new ArrayList<>(ALLOWED_SERVICES);
        Collections.sort(sorted);
        for (String name : sorted) {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("name", name);
            info.put("unit", "shield-" + name);
            info.put("status", getServiceStatus(name));
            result.add(info);
        }
        return ResponseEntity.ok(result);
    }

    /** POST /api/v1/admin/platform/services/{name}/restart — K8s: returns current health */
    @Operation(summary = "Restart a service (K8s)", description = "Logs a restart action and returns the kubectl rollout restart command; actual restart must be performed via Kubernetes.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Restart action logged"),
        @ApiResponse(responseCode = "400", description = "Invalid service name"),
        @ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    @PostMapping("/services/{name}/restart")
    public ResponseEntity<Map<String, Object>> restartService(@PathVariable String name,
                                                                @RequestHeader("X-User-Role") String role,
                                                                HttpServletRequest req) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String unit = "shield-" + name;
        auditLogService.log("SERVICE_RESTART", "Service", unit,
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of("service", unit));
        return ResponseEntity.ok(Map.of("service", unit, "action", "restart",
                "output", "In Kubernetes, use kubectl rollout restart deployment/" + unit + " -n shield-prod",
                "status", getServiceStatus(name)));
    }

    /** POST /api/v1/admin/platform/services/{name}/stop */
    @Operation(summary = "Stop a service (K8s)", description = "Logs a stop action and returns the kubectl scale-down command.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Stop action logged"),
        @ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    @PostMapping("/services/{name}/stop")
    public ResponseEntity<Map<String, Object>> stopService(@PathVariable String name,
                                                            @RequestHeader("X-User-Role") String role,
                                                            HttpServletRequest req) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String unit = "shield-" + name;
        auditLogService.log("SERVICE_STOP", "Service", unit,
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of("service", unit));
        return ResponseEntity.ok(Map.of("service", unit, "action", "stop",
                "output", "Scale down via: kubectl scale deployment/" + unit + " -n shield-prod --replicas=0",
                "status", getServiceStatus(name)));
    }

    /** POST /api/v1/admin/platform/services/{name}/start */
    @Operation(summary = "Start a service (K8s)", description = "Logs a start action and returns the kubectl scale-up command.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Start action logged"),
        @ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    @PostMapping("/services/{name}/start")
    public ResponseEntity<Map<String, Object>> startService(@PathVariable String name,
                                                            @RequestHeader("X-User-Role") String role,
                                                            HttpServletRequest req) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String unit = "shield-" + name;
        auditLogService.log("SERVICE_START", "Service", unit,
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of("service", unit));
        return ResponseEntity.ok(Map.of("service", unit, "action", "start",
                "output", "Scale up via: kubectl scale deployment/" + unit + " -n shield-prod --replicas=1",
                "status", getServiceStatus(name)));
    }

    /** GET /api/v1/admin/platform/services/{name}/logs — returns recent health check result */
    @Operation(summary = "Get recent service logs (K8s)", description = "Returns the current health check result and the kubectl logs command for fetching real pod logs.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Log info returned"),
        @ApiResponse(responseCode = "403", description = "GLOBAL_ADMIN role required")
    })
    @GetMapping("/services/{name}/logs")
    public ResponseEntity<Map<String, Object>> serviceLogs(@PathVariable String name,
                                                            @RequestHeader("X-User-Role") String role,
                                                            @RequestParam(defaultValue = "50") int lines) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String status = getServiceStatus(name);
        String logs = String.format("[%s] shield-%s health: %s%nRunning in Kubernetes (AKS). Use kubectl logs for pod logs:%n  kubectl logs -n shield-prod -l app=shield-%s --tail=%d",
                OffsetDateTime.now(), name, status, name, lines);
        return ResponseEntity.ok(Map.of("service", "shield-" + name, "lines", lines, "logs", logs));
    }

    // --- Helpers ---

    private void validateServiceName(String name) {
        if (!ALLOWED_SERVICES.contains(name)) {
            throw new IllegalArgumentException("Invalid service name: " + name + ". Allowed: " + ALLOWED_SERVICES);
        }
    }

    /**
     * Check service health via HTTP GET to its /actuator/health endpoint.
     * In Kubernetes, services are reachable at shield-{name}:{port}/actuator/health.
     * Returns "active" (UP), "inactive" (DOWN), or "unknown".
     */
    private String getServiceStatus(String name) {
        Integer port = SERVICE_PORTS.get(name);
        if (port == null) return "unknown";
        String healthPath = name.equals("ai") ? "/actuator/health" : "/actuator/health";
        String urlStr = "http://shield-" + name + ":" + port + healthPath;
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            int code = conn.getResponseCode();
            conn.disconnect();
            return (code >= 200 && code < 300) ? "active" : "inactive";
        } catch (Exception e) {
            log.debug("Health check failed for shield-{}: {}", name, e.getMessage());
            return "inactive";
        }
    }

    private UUID getUserId(HttpServletRequest req) {
        String header = req.getHeader("X-User-Id");
        try { return header != null ? UUID.fromString(header) : null; } catch (Exception e) { return null; }
    }

    private String getUserName(HttpServletRequest req) {
        return req.getHeader("X-User-Name");
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
