package com.rstglobal.shield.rewards.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BadgeResponse {

    private String id;
    private String name;
    private String description;
    private String iconEmoji;
    private String category;
    private int threshold;
}
