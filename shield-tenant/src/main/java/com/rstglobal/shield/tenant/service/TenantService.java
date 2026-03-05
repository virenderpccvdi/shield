package com.rstglobal.shield.tenant.service;

import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.dto.request.CreateTenantRequest;
import com.rstglobal.shield.tenant.dto.request.UpdateTenantRequest;
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
        if (req.getPlan()                   != null) tenant.setPlan(req.getPlan());
        if (req.getMaxCustomers()           != null) tenant.setMaxCustomers(req.getMaxCustomers());
        if (req.getMaxProfilesPerCustomer() != null) tenant.setMaxProfilesPerCustomer(req.getMaxProfilesPerCustomer());
        if (req.getFeatures()               != null) tenant.setFeatures(req.getFeatures());
        if (req.getActive()                 != null) tenant.setActive(req.getActive());
        if (req.getTrialEndsAt()            != null) tenant.setTrialEndsAt(req.getTrialEndsAt());
        if (req.getSubscriptionEndsAt()     != null) tenant.setSubscriptionEndsAt(req.getSubscriptionEndsAt());

        return toResponse(tenantRepository.save(tenant));
    }

    // ── Feature flag toggle ───────────────────────────────────────────────────

    @Transactional
    public TenantResponse toggleFeature(UUID id, String feature, boolean enabled) {
        Tenant tenant = findOrThrow(id);
        Map<String, Boolean> features = tenant.getFeatures() != null
                ? new HashMap<>(tenant.getFeatures()) : new HashMap<>(DEFAULT_FEATURES);
        features.put(feature, enabled);
        tenant.setFeatures(features);
        return toResponse(tenantRepository.save(tenant));
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
                .build();
    }
}
