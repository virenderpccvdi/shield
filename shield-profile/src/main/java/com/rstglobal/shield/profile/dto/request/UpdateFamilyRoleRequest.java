package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateFamilyRoleRequest {

    @NotBlank
    private String role;  // CO_PARENT, OBSERVER, GUARDIAN
}
