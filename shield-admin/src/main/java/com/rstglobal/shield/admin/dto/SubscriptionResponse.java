package com.rstglobal.shield.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Data
@Builder
public class SubscriptionResponse {
    private String planName;
    private String planDisplayName;
    private BigDecimal price;
    private String billingCycle;
    private String status;
    private Instant expiresAt;
    private String stripeSubscriptionId;
    private Map<String, Boolean> features;
    private int maxProfiles;
    private int maxCustomers;
}
