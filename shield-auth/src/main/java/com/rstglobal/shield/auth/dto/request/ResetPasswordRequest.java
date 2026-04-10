package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Supports two reset flows:
 *   1. Link-based (email / web): provide {@code token} = Base64(userId:otp) from reset email link.
 *   2. In-app (mobile): provide {@code email} + {@code code} (OTP entered manually).
 */
@Data
public class ResetPasswordRequest {

    /** Base64-encoded "userId:otp" token — used when following the email link. */
    private String token;

    /** Email address — used in the mobile in-app OTP flow (alternative to token). */
    private String email;

    /** 6-digit OTP entered manually — used together with {@code email}. */
    private String code;

    @NotBlank
    @Size(min = 8, max = 128, message = "Password must be 8–128 characters")
    @Pattern(
        regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$",
        message = "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character"
    )
    private String newPassword;
}
