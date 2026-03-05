package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FamilyInviteRequest {

    @NotBlank @Email
    private String email;

    /** CO_PARENT, OBSERVER — defaults to CO_PARENT */
    private String role;
}
