package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomersSummaryResponse {
    private long totalCustomers;
    private long activeCustomers;
    private long newThisMonth;
    private long profilesProtected;
}
