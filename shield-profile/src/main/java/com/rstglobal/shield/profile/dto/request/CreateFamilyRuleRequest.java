package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateFamilyRuleRequest {

    @NotBlank
    @Size(max = 200)
    private String title;

    private String description;

    private String icon = "rule";

    private UUID customerId;
}
