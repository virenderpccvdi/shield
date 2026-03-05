package com.rstglobal.shield.tenant.dto.request;

import com.rstglobal.shield.tenant.entity.TenantPlan;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.Instant;
import java.util.Map;

@Data
public class UpdateTenantRequest {

    @Size(max = 150)
    private String name;

    @Email @Size(max = 254)
    private String contactEmail;

    @Size(max = 20)
    private String contactPhone;

    private String logoUrl;

    @Pattern(regexp = "^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
    private String primaryColor;

    private TenantPlan plan;

    @Min(1) @Max(100000)
    private Integer maxCustomers;

    @Min(1) @Max(20)
    private Integer maxProfilesPerCustomer;

    private Map<String, Boolean> features;

    private Boolean active;

    private Instant trialEndsAt;
    private Instant subscriptionEndsAt;
}
