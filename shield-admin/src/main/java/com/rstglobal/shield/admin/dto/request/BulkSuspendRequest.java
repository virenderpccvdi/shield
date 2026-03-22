package com.rstglobal.shield.admin.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record BulkSuspendRequest(
        @NotNull @NotEmpty List<UUID> tenantIds,
        String reason
) {}
