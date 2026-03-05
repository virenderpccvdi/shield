package com.rstglobal.shield.rewards.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateTaskRequest {

    @NotNull(message = "Profile ID is required")
    private UUID profileId;

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @Positive(message = "Reward minutes must be positive")
    private int rewardMinutes = 30;

    @Positive(message = "Reward points must be positive")
    private int rewardPoints = 10;

    private LocalDate dueDate;

    private String recurrence = "ONCE";
}
