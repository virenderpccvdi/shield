package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ChildTokenRequest {

    @NotNull
    private UUID parentUserId;

    @NotNull
    private UUID childProfileId;

    @NotNull
    private String pin;
}
