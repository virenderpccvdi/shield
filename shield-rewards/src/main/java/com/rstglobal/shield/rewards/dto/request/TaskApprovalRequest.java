package com.rstglobal.shield.rewards.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TaskApprovalRequest {

    @NotNull(message = "Approval decision is required")
    private Boolean approved;

    private String rejectionNote;
}
