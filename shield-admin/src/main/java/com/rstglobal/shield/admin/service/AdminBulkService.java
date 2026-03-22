package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.response.BulkOpResult;
import com.rstglobal.shield.admin.dto.response.PlatformStatsResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Orchestrates bulk admin operations across all tenants by calling
 * shield-tenant internal endpoints via Eureka service discovery.
 *
 * All operations are non-fatal per-tenant: failures are collected
 * and returned in BulkOpResult rather than aborting the batch.
 */
@Slf4j
@Service
public class AdminBulkService {

    private static final String TENANT_SERVICE_ID   = "SHIELD-TENANT";
    private static final String ANALYTICS_SERVICE_ID = "SHIELD-ANALYTICS";

    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public AdminBulkService(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    // ── Suspend ──────────────────────────────────────────────────────────────

    /**
     * Suspend a batch of tenants. Calls POST /internal/tenants/{id}/suspend
     * on shield-tenant for each ID.
     */
    public BulkOpResult suspendTenants(List<UUID> ids, String reason) {
        String baseUrl = resolveTenantBaseUrl();
        if (baseUrl == null) {
            return new BulkOpResult(0, ids.size(),
                    List.of("shield-tenant service unavailable — no instances in Eureka"));
        }

        int succeeded = 0;
        int failed    = 0;
        List<String> errors = new ArrayList<>();

        for (UUID id : ids) {
            try {
                Map<String, String> body = reason != null
                        ? Map.of("reason", reason)
                        : Map.of();
                restClient.post()
                        .uri(baseUrl + "/internal/tenants/" + id + "/suspend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();
                succeeded++;
                log.info("Suspended tenant {}", id);
            } catch (Exception e) {
                failed++;
                String msg = "tenant " + id + ": " + e.getMessage();
                errors.add(msg);
                log.warn("Failed to suspend {}: {}", id, e.getMessage());
            }
        }
        return new BulkOpResult(succeeded, failed, errors);
    }

    // ── Activate ─────────────────────────────────────────────────────────────

    /**
     * Re-activate a batch of tenants. Calls POST /internal/tenants/{id}/activate
     * on shield-tenant for each ID.
     */
    public BulkOpResult activateTenants(List<UUID> ids) {
        String baseUrl = resolveTenantBaseUrl();
        if (baseUrl == null) {
            return new BulkOpResult(0, ids.size(),
                    List.of("shield-tenant service unavailable — no instances in Eureka"));
        }

        int succeeded = 0;
        int failed    = 0;
        List<String> errors = new ArrayList<>();

        for (UUID id : ids) {
            try {
                restClient.post()
                        .uri(baseUrl + "/internal/tenants/" + id + "/activate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .retrieve()
                        .toBodilessEntity();
                succeeded++;
                log.info("Activated tenant {}", id);
            } catch (Exception e) {
                failed++;
                errors.add("tenant " + id + ": " + e.getMessage());
                log.warn("Failed to activate {}: {}", id, e.getMessage());
            }
        }
        return new BulkOpResult(succeeded, failed, errors);
    }

    // ── Feature flag ─────────────────────────────────────────────────────────

    /**
     * Toggle a feature flag on a batch of tenants. Calls
     * PUT /internal/tenants/{id}/features on shield-tenant for each ID.
     */
    public BulkOpResult setFeatureFlag(List<UUID> ids, String feature, boolean enabled) {
        String baseUrl = resolveTenantBaseUrl();
        if (baseUrl == null) {
            return new BulkOpResult(0, ids.size(),
                    List.of("shield-tenant service unavailable — no instances in Eureka"));
        }

        int succeeded = 0;
        int failed    = 0;
        List<String> errors = new ArrayList<>();

        Map<String, Object> body = Map.of("feature", feature, "enabled", enabled);

        for (UUID id : ids) {
            try {
                restClient.put()
                        .uri(baseUrl + "/internal/tenants/" + id + "/features")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();
                succeeded++;
                log.info("Set feature {} = {} on tenant {}", feature, enabled, id);
            } catch (Exception e) {
                failed++;
                errors.add("tenant " + id + ": " + e.getMessage());
                log.warn("Failed to set feature {} on {}: {}", feature, id, e.getMessage());
            }
        }
        return new BulkOpResult(succeeded, failed, errors);
    }

    // ── Platform stats ───────────────────────────────────────────────────────

    /**
     * Fetch platform-wide tenant statistics from shield-analytics
     * GET /api/v1/analytics/platform/overview.
     *
     * Falls back to zero-values when analytics service is unreachable.
     */
    public PlatformStatsResponse getPlatformStats() {
        String baseUrl = resolveAnalyticsBaseUrl();
        if (baseUrl == null) {
            log.warn("shield-analytics service unavailable — returning empty platform stats");
            return new PlatformStatsResponse(0, 0, 0, 0, null);
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> overview = restClient.get()
                    .uri(baseUrl + "/api/v1/analytics/platform/overview")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Map.class);

            if (overview == null) {
                return new PlatformStatsResponse(0, 0, 0, 0, null);
            }

            // analytics/platform/overview wraps data under "data" key when ApiResponse is used
            @SuppressWarnings("unchecked")
            Map<String, Object> data = overview.containsKey("data")
                    ? (Map<String, Object>) overview.get("data")
                    : overview;

            return new PlatformStatsResponse(
                    toLong(data.get("totalTenants")),
                    toLong(data.get("activeTenants")),
                    toLong(data.get("totalProfiles")),
                    toLong(data.get("totalQueriesAllTime")),
                    data.get("topBlockedCategory") instanceof String s ? s : null
            );
        } catch (Exception e) {
            log.warn("Failed to fetch platform stats from analytics: {}", e.getMessage());
            return new PlatformStatsResponse(0, 0, 0, 0, null);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String resolveTenantBaseUrl() {
        return resolveBaseUrl(TENANT_SERVICE_ID);
    }

    private String resolveAnalyticsBaseUrl() {
        return resolveBaseUrl(ANALYTICS_SERVICE_ID);
    }

    private String resolveBaseUrl(String serviceId) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceId);
        if (instances.isEmpty()) {
            log.warn("No instances of {} registered in Eureka", serviceId);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    private static long toLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        return 0L;
    }
}
