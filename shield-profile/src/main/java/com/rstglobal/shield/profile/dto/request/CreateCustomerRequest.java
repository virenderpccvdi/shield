package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateCustomerRequest {
    @NotNull
    private UUID userId;
    private String subscriptionPlan;   // BASIC | STANDARD | PREMIUM
    private Integer maxProfiles;
}
