package com.rstglobal.shield.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class BrandingResponse {

    private UUID id;
    private UUID tenantId;
    private String appName;
    private String logoUrl;
    private String primaryColor;
    private String secondaryColor;
    private String supportEmail;
    private String supportPhone;
    private String websiteUrl;
    private String appBundleId;
    private String playStoreUrl;
    private String customDomain;
    private Boolean isActive;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
