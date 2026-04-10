package com.rstglobal.shield.admin.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class PublicPlanResponse {
    private final UUID id;
    private final String name;
    private final String displayName;
    private final BigDecimal price;
    private final String billingCycle;
    private final String description;
    private final Map<String, Boolean> features;
    private final Integer maxProfilesPerCustomer;
    private final Integer sortOrder;
}
