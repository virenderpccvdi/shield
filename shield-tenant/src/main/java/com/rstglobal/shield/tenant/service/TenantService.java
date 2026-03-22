package com.rstglobal.shield.tenant.service;

import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.dto.request.CreateTenantRequest;
import com.rstglobal.shield.tenant.dto.request.UpdateBrandingRequest;
import com.rstglobal.shield.tenant.dto.request.UpdateTenantRequest;
import com.rstglobal.shield.tenant.dto.response.BrandingResponse;
import com.rstglobal.shield.tenant.dto.response.TenantResponse;
import com.rstglobal.shield.tenant.entity.Tenant;
import com.rstglobal.shield.tenant.entity.TenantPlan;
import com.rstglobal.shield.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantService {

    private static final Map<String, Boolean> DEFAULT_FEATURES = Map.of(
            "dns_filtering",      true,
            "ai_monitoring",      false,
            "gps_tracking",       false,
            "screen_time",        true,
            "rewards",            false,
            "instant_pause",      true,
            "content_reporting",  false,
            "multi_admin",        false
    );

    private static final Map<TenantPlan, Map<String, Object>> PLAN_DEFAULTS = Map.of(
        TenantPlan.STARTER, Map.of(
            "maxCustomers", 100,
            "maxProfilesPerCustomer", 5,
            "features", Map.of(
                "dns_filtering", true, "ai_monitoring", false, "gps_tracking", false,
                "screen_time", true, "rewards", false, "instant_pause", true,
                "content_reporting", false, "multi_admin", false
            )
        ),
        TenantPlan.GROWTH, Map.of(
            "maxCustomers", 1000,
            "maxProfilesPerCustomer", 10,
            "features", Map.of(
                "dns_filtering", true, "ai_monitoring", true, "gps_tracking", true,
                "screen_time", true, "rewards", true, "instant_pause", true,
                "content_reporting", true, "multi_admin", false
            )
        ),
        TenantPlan.ENTERPRISE, Map.of(
            "maxCustomers", 100000,
            "maxProfilesPerCustomer", 20,
            "features", Map.of(
                "dns_filtering", true, "ai_monitoring", true, "gps_tracking", true,
                "screen_time", true, "rewards", true, "instant_pause", true,
                "content_reporting", true, "multi_admin", true
            )
        )
    );

    private final TenantRepository tenantRepository;

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public TenantResponse create(CreateTenantRequest req) {
        if (tenantRepository.existsBySlug(req.getSlug())) {
            throw ShieldException.conflict("Tenant slug already exists: " + req.getSlug());
        }

        Tenant tenant = Tenant.builder()
                .slug(req.getSlug())
                .name(req.getName())
                .contactEmail(req.getContactEmail())
                .contactPhone(req.getContactPhone())
                .logoUrl(req.getLogoUrl())
                .primaryColor(req.getPrimaryColor() != null ? req.getPrimaryColor() : "#1565C0")
                .plan(req.getPlan() != null ? req.getPlan() : TenantPlan.STARTER)
                .maxCustomers(req.getMaxCustomers() != null ? req.getMaxCustomers() : 100)
                .maxProfilesPerCustomer(req.getMaxProfilesPerCustomer() != null ? req.getMaxProfilesPerCustomer() : 5)
                .features(req.getFeatures() != null ? req.getFeatures() : DEFAULT_FEATURES)
                .trialEndsAt(req.getTrialEndsAt())
                .subscriptionEndsAt(req.getSubscriptionEndsAt())
                .build();

        tenant = tenantRepository.save(tenant);
        log.info("Created tenant: {} ({})", tenant.getSlug(), tenant.getId());
        return toResponse(tenant);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public TenantResponse getById(UUID id) {
        return toResponse(findOrThrow(id));
    }

    public TenantResponse getBySlug(String slug) {
        return toResponse(tenantRepository.findBySlug(slug)
                .orElseThrow(() -> ShieldException.notFound("Tenant", slug)));
    }

    public PagedResponse<TenantResponse> list(String q, Pageable pageable) {
        Page<Tenant> page = (q != null && !q.isBlank())
                ? tenantRepository.search(q.trim(), pageable)
                : tenantRepository.findByActiveTrue(pageable);
        return PagedResponse.of(page.map(this::toResponse));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public TenantResponse update(UUID id, UpdateTenantRequest req) {
        Tenant tenant = findOrThrow(id);

        if (req.getName()                   != null) tenant.setName(req.getName());
        if (req.getContactEmail()           != null) tenant.setContactEmail(req.getContactEmail());
        if (req.getContactPhone()           != null) tenant.setContactPhone(req.getContactPhone());
        if (req.getLogoUrl()                != null) tenant.setLogoUrl(req.getLogoUrl());
        if (req.getPrimaryColor()           != null) tenant.setPrimaryColor(req.getPrimaryColor());
        if (req.getPlan()                   != null) {
            tenant.setPlan(req.getPlan());
            // Auto-apply plan defaults unless explicit overrides provided
            Map<String, Object> pd = PLAN_DEFAULTS.get(req.getPlan());
            if (pd != null) {
                if (req.getMaxCustomers() == null)
                    tenant.setMaxCustomers((Integer) pd.get("maxCustomers"));
                if (req.getMaxProfilesPerCustomer() == null)
                    tenant.setMaxProfilesPerCustomer((Integer) pd.get("maxProfilesPerCustomer"));
                if (req.getFeatures() == null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Boolean> f = (Map<String, Boolean>) pd.get("features");
                    tenant.setFeatures(f);
                }
            }
        }
        if (req.getMaxCustomers()           != null) tenant.setMaxCustomers(req.getMaxCustomers());
        if (req.getMaxProfilesPerCustomer() != null) tenant.setMaxProfilesPerCustomer(req.getMaxProfilesPerCustomer());
        if (req.getFeatures()               != null) tenant.setFeatures(req.getFeatures());
        if (req.getActive()                 != null) tenant.setActive(req.getActive());
        if (req.getTrialEndsAt()            != null) tenant.setTrialEndsAt(req.getTrialEndsAt());
        if (req.getSubscriptionEndsAt()     != null) tenant.setSubscriptionEndsAt(req.getSubscriptionEndsAt());

        return toResponse(tenantRepository.save(tenant));
    }

    // ── Feature flag toggle ───────────────────────────────────────────────────

    /** Force re-apply PLAN_DEFAULTS for the tenant's current plan. */
    @Transactional
    public TenantResponse syncPlanFeatures(UUID id) {
        Tenant tenant = findOrThrow(id);
        Map<String, Object> pd = PLAN_DEFAULTS.get(tenant.getPlan());
        if (pd != null) {
            tenant.setMaxCustomers((Integer) pd.get("maxCustomers"));
            tenant.setMaxProfilesPerCustomer((Integer) pd.get("maxProfilesPerCustomer"));
            @SuppressWarnings("unchecked")
            Map<String, Boolean> f = (Map<String, Boolean>) pd.get("features");
            tenant.setFeatures(new HashMap<>(f));
        }
        return toResponse(tenantRepository.save(tenant));
    }

    @Transactional
    public TenantResponse toggleFeature(UUID id, String feature, boolean enabled) {
        Tenant tenant = findOrThrow(id);
        Map<String, Boolean> features = tenant.getFeatures() != null
                ? new HashMap<>(tenant.getFeatures()) : new HashMap<>(DEFAULT_FEATURES);
        features.put(feature, enabled);
        tenant.setFeatures(features);
        return toResponse(tenantRepository.save(tenant));
    }

    // ── Branding ─────────────────────────────────────────────────────────────

    public BrandingResponse getBranding(UUID tenantId) {
        Tenant t = findOrThrow(tenantId);
        return toBrandingResponse(t);
    }

    @Transactional
    public BrandingResponse updateBranding(UUID tenantId, UpdateBrandingRequest req) {
        Tenant t = findOrThrow(tenantId);
        if (req.getBrandName()    != null) t.setBrandName(req.getBrandName());
        if (req.getBrandColor()   != null) t.setBrandColor(req.getBrandColor());
        if (req.getBrandLogoUrl() != null) t.setBrandLogoUrl(req.getBrandLogoUrl());
        if (req.getSupportEmail() != null) t.setSupportEmail(req.getSupportEmail());
        if (req.getSupportPhone() != null) t.setSupportPhone(req.getSupportPhone());
        tenantRepository.save(t);
        log.info("Updated branding for tenant {}", tenantId);
        return toBrandingResponse(t);
    }

    private BrandingResponse toBrandingResponse(Tenant t) {
        return BrandingResponse.builder()
                .tenantId(t.getId())
                .brandName(t.getBrandName() != null ? t.getBrandName() : t.getName())
                .brandColor(t.getBrandColor() != null ? t.getBrandColor() : "#00897B")
                .brandLogoUrl(t.getBrandLogoUrl() != null ? t.getBrandLogoUrl() : t.getLogoUrl())
                .supportEmail(t.getSupportEmail() != null ? t.getSupportEmail() : t.getContactEmail())
                .supportPhone(t.getSupportPhone() != null ? t.getSupportPhone() : t.getContactPhone())
                .build();
    }

    // ── Delete (soft) ─────────────────────────────────────────────────────────

    @Transactional
    public void delete(UUID id) {
        Tenant tenant = findOrThrow(id);
        tenant.setActive(false);
        tenant.setDeletedAt(Instant.now());
        tenantRepository.save(tenant);
        log.info("Soft-deleted tenant {}", id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Tenant findOrThrow(UUID id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Tenant", id));
    }

    private TenantResponse toResponse(Tenant t) {
        return TenantResponse.builder()
                .id(t.getId())
                .slug(t.getSlug())
                .name(t.getName())
                .contactEmail(t.getContactEmail())
                .contactPhone(t.getContactPhone())
                .logoUrl(t.getLogoUrl())
                .primaryColor(t.getPrimaryColor())
                .plan(t.getPlan())
                .maxCustomers(t.getMaxCustomers())
                .maxProfilesPerCustomer(t.getMaxProfilesPerCustomer())
                .features(t.getFeatures())
                .active(t.isActive())
                .trialEndsAt(t.getTrialEndsAt())
                .subscriptionEndsAt(t.getSubscriptionEndsAt())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .brandName(t.getBrandName())
                .brandColor(t.getBrandColor())
                .brandLogoUrl(t.getBrandLogoUrl())
                .supportEmail(t.getSupportEmail())
                .supportPhone(t.getSupportPhone())
                .build();
    }
}
