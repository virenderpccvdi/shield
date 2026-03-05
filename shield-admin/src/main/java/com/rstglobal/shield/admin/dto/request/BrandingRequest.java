package com.rstglobal.shield.admin.dto.request;

import lombok.Data;

@Data
public class BrandingRequest {

    private String appName;
    private String logoUrl;
    private String primaryColor;
    private String secondaryColor;
    private String supportEmail;
    private String supportPhone;
    private String websiteUrl;
    private String customDomain;
}
