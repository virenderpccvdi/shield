package com.rstglobal.shield.admin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record BulkFeatureRequest(
        @NotNull @NotEmpty List<UUID> tenantIds,
        @NotBlank String feature,
        boolean enabled
) {}
