package com.rstglobal.shield.admin.dto.response;

public record PlatformStatsResponse(
        long totalTenants,
        long activeTenants,
        long totalProfiles,
        long totalQueriesAllTime,
        String topBlockedCategory
) {}
