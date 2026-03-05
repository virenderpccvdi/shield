package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ExtensionRequestDto {
    @NotBlank
    private String appName;

    @Positive
    private int requestedMins;

    private String message;
}
