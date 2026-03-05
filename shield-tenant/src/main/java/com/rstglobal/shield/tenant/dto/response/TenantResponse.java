package com.rstglobal.shield.tenant.dto.response;

import com.rstglobal.shield.tenant.entity.TenantPlan;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data @Builder
public class TenantResponse {
    private UUID    id;
    private String  slug;
    private String  name;
    private String  contactEmail;
    private String  contactPhone;
    private String  logoUrl;
    private String  primaryColor;
    private TenantPlan plan;
    private int     maxCustomers;
    private int     maxProfilesPerCustomer;
    private Map<String, Boolean> features;
    private boolean active;
    private Instant trialEndsAt;
    private Instant subscriptionEndsAt;
    private Instant createdAt;
    private Instant updatedAt;
}
