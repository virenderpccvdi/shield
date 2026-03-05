package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UsageStatsResponse {

    private UUID profileId;
    private String period;
    private long totalQueries;
    private long blockedQueries;
    private long allowedQueries;
    private double blockRate;
}
