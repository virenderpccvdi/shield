package com.rstglobal.shield.rewards.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class AchievementResponse {

    private String badgeType;
    private String badgeName;
    private String description;
    private OffsetDateTime earnedAt;
}
