package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ReorderFamilyRulesRequest {

    @NotNull
    private UUID customerId;

    @NotNull
    private List<UUID> orderedIds;
}
