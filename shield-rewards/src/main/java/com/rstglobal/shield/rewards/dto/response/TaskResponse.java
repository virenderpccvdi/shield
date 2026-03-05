package com.rstglobal.shield.rewards.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class TaskResponse {

    private UUID id;
    private UUID tenantId;
    private UUID profileId;
    private UUID createdBy;
    private String title;
    private String description;
    private int rewardMinutes;
    private int rewardPoints;
    private LocalDate dueDate;
    private String recurrence;
    private String status;
    private boolean active;
    private OffsetDateTime submittedAt;
    private OffsetDateTime approvedAt;
    private UUID approvedBy;
    private String rejectionNote;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
