package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HourlyCount {

    /** Hour of day (0–23). */
    private int hour;
    private long totalQueries;
    private long blockedQueries;
}
