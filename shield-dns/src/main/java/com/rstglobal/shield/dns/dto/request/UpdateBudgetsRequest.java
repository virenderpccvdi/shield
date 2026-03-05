package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class UpdateBudgetsRequest {
    /** Map of service key → daily limit in minutes (0 = no limit). */
    @NotNull
    private Map<String, Integer> budgets;
}
