package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.admin.repository.BulkImportJobRepository;
import com.rstglobal.shield.admin.repository.ComplianceReportRepository;
import com.rstglobal.shield.admin.repository.IspBrandingRepository;
import com.rstglobal.shield.admin.repository.Tr069ProvisionRepository;
import com.rstglobal.shield.admin.service.AuditLogService;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

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
            "eureka", "config", "gateway", "auth", "tenant", "profile",
            "dns", "location", "notification", "rewards", "analytics", "admin", "ai"
    );

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

    /** GET /api/v1/admin/platform/services — status of all 13 services */
    @GetMapping("/services")
    public ResponseEntity<List<Map<String, Object>>> listServices() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (String name : ALLOWED_SERVICES) {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("name", name);
            info.put("unit", "shield-" + name + ".service");
            info.put("status", getServiceStatus(name));
            result.add(info);
        }
        return ResponseEntity.ok(result);
    }

    /** POST /api/v1/admin/platform/services/{name}/restart */
    @PostMapping("/services/{name}/restart")
    public ResponseEntity<Map<String, Object>> restartService(@PathVariable String name,
                                                                @RequestHeader("X-User-Role") String role,
                                                                HttpServletRequest req) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String unit = "shield-" + name;
        String output = execCommand("systemctl", "restart", unit);
        auditLogService.log("SERVICE_RESTART", "Service", unit,
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of("service", unit));
        return ResponseEntity.ok(Map.of("service", unit, "action", "restart", "output", output, "status", getServiceStatus(name)));
    }

    /** POST /api/v1/admin/platform/services/{name}/stop */
    @PostMapping("/services/{name}/stop")
    public ResponseEntity<Map<String, Object>> stopService(@PathVariable String name,
                                                            @RequestHeader("X-User-Role") String role,
                                                            HttpServletRequest req) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String unit = "shield-" + name;
        String output = execCommand("systemctl", "stop", unit);
        auditLogService.log("SERVICE_STOP", "Service", unit,
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of("service", unit));
        return ResponseEntity.ok(Map.of("service", unit, "action", "stop", "output", output, "status", getServiceStatus(name)));
    }

    /** POST /api/v1/admin/platform/services/{name}/start */
    @PostMapping("/services/{name}/start")
    public ResponseEntity<Map<String, Object>> startService(@PathVariable String name,
                                                            @RequestHeader("X-User-Role") String role,
                                                            HttpServletRequest req) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        String unit = "shield-" + name;
        String output = execCommand("systemctl", "start", unit);
        auditLogService.log("SERVICE_START", "Service", unit,
                getUserId(req), getUserName(req), req.getRemoteAddr(), Map.of("service", unit));
        return ResponseEntity.ok(Map.of("service", unit, "action", "start", "output", output, "status", getServiceStatus(name)));
    }

    /** GET /api/v1/admin/platform/services/{name}/logs — last 50 lines */
    @GetMapping("/services/{name}/logs")
    public ResponseEntity<Map<String, Object>> serviceLogs(@PathVariable String name,
                                                            @RequestHeader("X-User-Role") String role,
                                                            @RequestParam(defaultValue = "50") int lines) {
        requireGlobalAdmin(role);
        validateServiceName(name);
        int safelines = Math.min(Math.max(lines, 10), 200);
        String output = execCommand("journalctl", "-u", "shield-" + name, "-n", String.valueOf(safelines), "--no-pager");
        return ResponseEntity.ok(Map.of("service", "shield-" + name, "lines", safelines, "logs", output));
    }

    // --- Helpers ---

    private void validateServiceName(String name) {
        if (!ALLOWED_SERVICES.contains(name)) {
            throw new IllegalArgumentException("Invalid service name: " + name + ". Allowed: " + ALLOWED_SERVICES);
        }
    }

    private String getServiceStatus(String name) {
        try {
            return execCommand("systemctl", "is-active", "shield-" + name).trim();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static final int MAX_OUTPUT_LENGTH = 10000;

    private String execCommand(String... cmd) {
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null && sb.length() < MAX_OUTPUT_LENGTH) {
                    if (sb.length() > 0) sb.append('\n');
                    sb.append(line);
                }
            }
            boolean finished = proc.waitFor(15, TimeUnit.SECONDS);
            if (!finished) {
                proc.destroyForcibly();
                sb.append("\n[truncated: command timed out]");
            }
            return sb.length() > MAX_OUTPUT_LENGTH
                    ? sb.substring(0, MAX_OUTPUT_LENGTH) + "\n[truncated]"
                    : sb.toString();
        } catch (Exception e) {
            log.error("Failed to execute command: {}", String.join(" ", cmd), e);
            return "error: command execution failed";
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
