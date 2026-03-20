package com.rstglobal.shield.profile.dto.request;

import lombok.Data;

@Data
public class UpdateCustomerRequest {
    private String subscriptionPlan;   // FREE, BASIC, PREMIUM, ENTERPRISE
    private String subscriptionStatus; // ACTIVE, SUSPENDED
    private Integer maxProfiles;
}
