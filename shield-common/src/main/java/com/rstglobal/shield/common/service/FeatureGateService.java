package com.rstglobal.shield.common.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Checks whether a named feature is enabled for a given tenant.
 *
 * <p>Calls shield-tenant's internal endpoint:
 * {@code GET /internal/tenants/{id}/features/{feature}}
 * and caches the result for 5 minutes to avoid repeated HTTP calls on every
 * request.  On any error (service down, network fault, etc.) the method
 * <em>fails open</em> — returning {@code true} — so that a transient
 * unavailability of shield-tenant never locks users out of features.
 *
 * <h3>Configuration</h3>
 * Set {@code shield.tenant.base-url} in each consuming microservice's
 * {@code application.yml}.  Defaults to {@code http://localhost:8282}.
 *
 * <h3>GLOBAL_ADMIN bypass</h3>
 * When {@code tenantId} is {@code null} the check is skipped and {@code true}
 * is returned, allowing platform admins unrestricted access.
 */
@Slf4j
@Service
public class FeatureGateService {

    /** Default base URL — overridden per-service via shield.tenant.base-url */
    @Value("${shield.tenant.base-url:http://localhost:8282}")
    private String tenantBaseUrl;

    /** In-memory TTL cache: "tenantId:feature" → Boolean */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private final RestClient restClient = RestClient.builder().build();

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns {@code true} if the feature is enabled for the tenant.
     *
     * @param tenantId UUID from the {@code X-Tenant-Id} header; {@code null} means GLOBAL_ADMIN → always allowed
     * @param feature  feature key, e.g. {@code "gps_tracking"}, {@code "rewards"}, {@code "weekly_digest"}
     */
    public boolean isEnabled(UUID tenantId, String feature) {
        if (tenantId == null) {
            return true; // GLOBAL_ADMIN — no tenant restriction
        }
        String cacheKey = tenantId + ":" + feature;
        CacheEntry entry = cache.get(cacheKey);
        if (entry != null && !entry.isExpired()) {
            return entry.value;
        }
        boolean result = fetchFromTenantService(tenantId, feature);
        cache.put(cacheKey, new CacheEntry(result, System.currentTimeMillis() + 300_000L));
        return result;
    }

    /**
     * Evicts all cached feature results for a specific tenant.
     * Call this after updating a tenant's feature flags to ensure the change
     * is visible within seconds rather than waiting for the 5-minute TTL.
     *
     * @param tenantId the tenant whose cache entries should be removed
     */
    public void invalidate(UUID tenantId) {
        if (tenantId == null) return;
        String prefix = tenantId.toString();
        cache.entrySet().removeIf(e -> e.getKey().startsWith(prefix));
        log.debug("FeatureGateService: cache invalidated for tenant={}", tenantId);
    }

    // ── Scheduled cache flush ─────────────────────────────────────────────────

    /** Clears the entire cache every 5 minutes so stale entries never accumulate. */
    @Scheduled(fixedDelay = 300_000)
    public void clearCache() {
        cache.clear();
        log.debug("FeatureGateService: periodic cache cleared");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private boolean fetchFromTenantService(UUID tenantId, String feature) {
        try {
            Boolean result = restClient.get()
                    .uri(tenantBaseUrl + "/internal/tenants/" + tenantId + "/features/" + feature)
                    .retrieve()
                    .body(Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("FeatureGateService: failed to check feature '{}' for tenant={} — failing open. Reason: {}",
                    feature, tenantId, e.getMessage());
            return true; // fail open — never lock users out due to service unavailability
        }
    }

    // ── Cache entry ───────────────────────────────────────────────────────────

    private record CacheEntry(boolean value, long expiresAt) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }
}
