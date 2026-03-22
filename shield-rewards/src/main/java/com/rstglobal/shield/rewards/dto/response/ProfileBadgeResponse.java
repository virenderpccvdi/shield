package com.rstglobal.shield.rewards.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class ProfileBadgeResponse {

    private UUID id;
    private UUID profileId;
    private String badgeId;
    private String badgeName;
    private String badgeDescription;
    private String iconEmoji;
    private String category;
    private OffsetDateTime earnedAt;
}
