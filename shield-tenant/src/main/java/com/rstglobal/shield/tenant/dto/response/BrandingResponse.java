package com.rstglobal.shield.tenant.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data @Builder
public class BrandingResponse {
    private UUID   tenantId;
    private String brandName;
    private String brandColor;
    private String brandLogoUrl;
    private String supportEmail;
    private String supportPhone;
}
