package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class FamilyRuleResponse {
    private UUID id;
    private UUID customerId;
    private String title;
    private String description;
    private String icon;
    private Boolean active;
    private Integer sortOrder;
    private OffsetDateTime createdAt;
}
