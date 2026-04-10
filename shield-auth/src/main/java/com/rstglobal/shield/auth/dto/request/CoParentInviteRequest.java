package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CoParentInviteRequest {

    /** Email address of the person being invited as co-parent. */
    @NotBlank @Email
    private String email;

    /** The tenant (ISP/family account) the co-parent will be linked to. */
    private UUID tenantId;

    /** Display name for the family used in the invitation email subject. */
    @Size(max = 100)
    private String familyName;
}
