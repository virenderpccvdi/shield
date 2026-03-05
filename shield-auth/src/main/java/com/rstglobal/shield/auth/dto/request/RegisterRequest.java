package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class RegisterRequest {

    @NotBlank @Email
    private String email;

    @NotBlank @Size(min = 8, max = 128)
    private String password;

    @NotBlank @Size(max = 100)
    private String name;

    @Size(max = 20)
    private String phone;

    /** Optional: the tenant this user belongs to (required for ISP_ADMIN / CUSTOMER). */
    private UUID tenantId;
}
