package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class BudgetTodayResponse {
    private UUID profileId;
    private LocalDate date;
    private Map<String, AppUsage> usage;

    @Data
    @Builder
    public static class AppUsage {
        private int limitMinutes;
        private int usedMinutes;
        private String status; // ACTIVE | PAUSED | EXCEEDED
    }
}
