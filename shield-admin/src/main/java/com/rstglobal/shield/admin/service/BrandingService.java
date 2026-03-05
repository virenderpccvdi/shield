package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.request.BrandingRequest;
import com.rstglobal.shield.admin.dto.response.BrandingResponse;
import com.rstglobal.shield.admin.entity.IspBranding;
import com.rstglobal.shield.admin.repository.IspBrandingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BrandingService {

    private final IspBrandingRepository brandingRepository;

    public BrandingResponse getBranding(UUID tenantId) {
        IspBranding branding = brandingRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Branding config not found for tenant: " + tenantId));
        return toResponse(branding);
    }

    @Transactional
    public BrandingResponse upsertBranding(BrandingRequest req, UUID tenantId) {
        IspBranding branding = brandingRepository.findByTenantId(tenantId)
                .orElseGet(() -> IspBranding.builder().tenantId(tenantId).build());

        if (req.getAppName() != null)        branding.setAppName(req.getAppName());
        if (req.getLogoUrl() != null)        branding.setLogoUrl(req.getLogoUrl());
        if (req.getPrimaryColor() != null)   branding.setPrimaryColor(req.getPrimaryColor());
        if (req.getSecondaryColor() != null) branding.setSecondaryColor(req.getSecondaryColor());
        if (req.getSupportEmail() != null)   branding.setSupportEmail(req.getSupportEmail());
        if (req.getSupportPhone() != null)   branding.setSupportPhone(req.getSupportPhone());
        if (req.getWebsiteUrl() != null)     branding.setWebsiteUrl(req.getWebsiteUrl());
        if (req.getCustomDomain() != null)   branding.setCustomDomain(req.getCustomDomain());

        branding = brandingRepository.save(branding);
        log.info("Upserted branding config for tenant {}", tenantId);
        return toResponse(branding);
    }

    /**
     * Public endpoint for white-label app configuration lookup by custom domain slug.
     */
    public BrandingResponse getPublicBranding(String tenantSlug) {
        IspBranding branding = brandingRepository.findByCustomDomain(tenantSlug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No branding config found for domain: " + tenantSlug));
        return toResponse(branding);
    }

    private BrandingResponse toResponse(IspBranding b) {
        return BrandingResponse.builder()
                .id(b.getId())
                .tenantId(b.getTenantId())
                .appName(b.getAppName())
                .logoUrl(b.getLogoUrl())
                .primaryColor(b.getPrimaryColor())
                .secondaryColor(b.getSecondaryColor())
                .supportEmail(b.getSupportEmail())
                .supportPhone(b.getSupportPhone())
                .websiteUrl(b.getWebsiteUrl())
                .appBundleId(b.getAppBundleId())
                .playStoreUrl(b.getPlayStoreUrl())
                .customDomain(b.getCustomDomain())
                .isActive(b.getIsActive())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .build();
    }
}
