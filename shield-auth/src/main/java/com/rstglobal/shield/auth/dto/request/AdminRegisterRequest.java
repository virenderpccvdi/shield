package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Used by GLOBAL_ADMIN to create any-role user (ISP_ADMIN, CUSTOMER, GLOBAL_ADMIN).
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class AdminRegisterRequest extends RegisterRequest {

    /** Target role: GLOBAL_ADMIN | ISP_ADMIN | CUSTOMER */
    @NotBlank
    private String role;
}
