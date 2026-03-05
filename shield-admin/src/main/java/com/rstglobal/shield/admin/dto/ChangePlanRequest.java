package com.rstglobal.shield.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ChangePlanRequest {
    @NotNull
    private UUID planId;
}
