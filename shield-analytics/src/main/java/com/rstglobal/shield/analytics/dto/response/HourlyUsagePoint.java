package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HourlyUsagePoint {
    private int hour;
    private long count;
}
