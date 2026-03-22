package com.rstglobal.shield.auth.controller;

import com.rstglobal.shield.auth.dto.request.*;
import com.rstglobal.shield.auth.dto.response.AuthResponse;
import com.rstglobal.shield.auth.dto.response.MfaSetupResponse;
import com.rstglobal.shield.auth.dto.response.UserResponse;
import com.rstglobal.shield.auth.entity.UserRole;
import com.rstglobal.shield.auth.service.AuthService;
import com.rstglobal.shield.auth.service.MfaService;
import com.rstglobal.shield.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Authentication & token management")
public class AuthController {

    private final AuthService authService;
    private final MfaService  mfaService;

    /** Public: Register a new CUSTOMER account. ISP_ADMIN/GLOBAL_ADMIN created by admin endpoints. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a new customer account")
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest req, HttpServletRequest httpReq) {
        return ApiResponse.ok(authService.register(req, UserRole.CUSTOMER, extractIp(httpReq)));
    }

    /** Public: Login — returns access + refresh tokens. */
    @PostMapping("/login")
    @Operation(summary = "Login and receive JWT tokens")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest httpReq) {
        return ApiResponse.ok(authService.login(req, extractIp(httpReq)));
    }

    /** Public: Refresh access token using a valid refresh token. */
    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshRequest req) {
        return ApiResponse.ok(authService.refresh(req));
    }

    /** Public: Request a password reset OTP (sent via notification service). */
    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset OTP")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.forgotPassword(req);
        return ApiResponse.ok(null, "If this email is registered, a reset code has been sent.");
    }

    /** Public: Reset password with OTP token. */
    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with token")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        authService.resetPassword(req);
        return ApiResponse.ok(null, "Password reset successfully.");
    }

    /** Authenticated: Logout — invalidates the refresh token and blacklists the access token. */
    @PostMapping("/logout")
    @Operation(summary = "Logout — revoke refresh token and blacklist access token")
    public ApiResponse<Void> logout(
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @RequestBody(required = false) RefreshRequest req) {
        authService.logout(userId, req != null ? req.getRefreshToken() : null);
        return ApiResponse.ok(null, "Logged out successfully.");
    }

    /** Authenticated: Change password. */
    @PostMapping("/change-password")
    @Operation(summary = "Change password (requires current password)")
    public ApiResponse<Void> changePassword(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(userId, req);
        return ApiResponse.ok(null, "Password changed successfully.");
    }

    /** Authenticated: Get current user profile. */
    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ApiResponse<UserResponse> me(@RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.ok(authService.getMe(userId));
    }

    /** Authenticated: Update current user profile (name, phone). */
    @PutMapping("/me")
    @Operation(summary = "Update current user profile")
    public ApiResponse<UserResponse> updateProfile(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody UpdateProfileRequest req) {
        return ApiResponse.ok(authService.updateProfile(userId, req));
    }

    // ── MFA Endpoints ──────────────────────────────────────────────────────

    /** Authenticated: Set up MFA — generates TOTP secret + QR code URL + backup codes. */
    @PostMapping("/mfa/setup")
    @Operation(summary = "Generate TOTP secret and QR code for MFA setup")
    public ApiResponse<MfaSetupResponse> mfaSetup(@RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.ok(mfaService.setup(userId));
    }

    /** Authenticated: Verify TOTP code and enable MFA on the account. */
    @PostMapping("/mfa/verify")
    @Operation(summary = "Verify TOTP code and enable MFA")
    public ApiResponse<Void> mfaVerify(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody MfaVerifyRequest req) {
        mfaService.verifyAndEnable(userId, req.getCode());
        return ApiResponse.ok(null, "MFA enabled successfully.");
    }

    /** Authenticated: Disable MFA — requires current TOTP code or backup code. */
    @PostMapping("/mfa/disable")
    @Operation(summary = "Disable MFA (requires TOTP or backup code)")
    public ApiResponse<Void> mfaDisable(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody MfaVerifyRequest req) {
        mfaService.disable(userId, req.getCode());
        return ApiResponse.ok(null, "MFA disabled successfully.");
    }

    /** Public: Validate MFA code during login — completes the 2-step login flow. */
    @PostMapping("/mfa/validate")
    @Operation(summary = "Validate TOTP code with MFA token to complete login")
    public ApiResponse<AuthResponse> mfaValidate(@Valid @RequestBody MfaValidateRequest req) {
        return ApiResponse.ok(authService.completeMfaLogin(req.getMfaToken(), req.getCode()));
    }

    /** GLOBAL_ADMIN: List all users with optional role filter. */
    @GetMapping("/users")
    @Operation(summary = "List all users (GLOBAL_ADMIN only)")
    public ApiResponse<Page<UserResponse>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String role) {
        return ApiResponse.ok(authService.listUsers(page, size, role));
    }

    /** GLOBAL_ADMIN: Create a user with an explicit role (ISP_ADMIN, CUSTOMER, GLOBAL_ADMIN).
     *  Also sends a welcome email with a password-setup link valid for 24 hours. */
    @PostMapping("/admin/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Admin: create user with explicit role + send welcome email (GLOBAL_ADMIN only)")
    public ApiResponse<UserResponse> adminRegister(@Valid @RequestBody AdminRegisterRequest req) {
        UserRole role;
        try {
            role = UserRole.valueOf(req.getRole().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw com.rstglobal.shield.common.exception.ShieldException.badRequest("Invalid role: " + req.getRole());
        }
        return ApiResponse.ok(authService.adminRegister(req, role));
    }

    /** Authenticated: Issue a limited child device token. Caller must be the parent. */
    @PostMapping("/child/token")
    @Operation(summary = "Issue child app token for a child profile (requires parent JWT)")
    public ApiResponse<AuthResponse> childToken(
            @Valid @RequestBody com.rstglobal.shield.auth.dto.request.ChildTokenRequest req,
            @RequestHeader(value = "X-User-Id", required = false) UUID callerId) {
        // Gateway injects X-User-Id from the validated JWT.
        // Verify that the caller IS the claimed parentUserId (prevents impersonation).
        if (callerId != null && !callerId.equals(req.getParentUserId())) {
            throw com.rstglobal.shield.common.exception.ShieldException.forbidden(
                    "Caller is not the parent of this profile");
        }
        return ApiResponse.ok(authService.issueChildToken(
                req.getParentUserId(), req.getChildProfileId(), req.getPin()));
    }

    /** GLOBAL_ADMIN: Update user details (name, phone, role, active status). */
    @PutMapping("/admin/users/{id}")
    @Operation(summary = "Admin: update user (GLOBAL_ADMIN only)")
    public ApiResponse<UserResponse> adminUpdateUser(
            @PathVariable UUID id,
            @RequestBody java.util.Map<String, Object> updates) {
        return ApiResponse.ok(authService.adminUpdateUser(id, updates));
    }

    /** GLOBAL_ADMIN: Delete user (soft delete). */
    @DeleteMapping("/admin/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Admin: delete user (GLOBAL_ADMIN only)")
    public void adminDeleteUser(@PathVariable UUID id) {
        authService.adminDeleteUser(id);
    }

    /**
     * ISP_ADMIN or GLOBAL_ADMIN: Reset a user's password.
     * ISP_ADMIN can only reset passwords of CUSTOMER accounts in their own tenant.
     * GLOBAL_ADMIN can reset any user's password.
     * Sends email notification to the user with the new password.
     */
    @PostMapping("/admin/users/{id}/reset-password")
    @Operation(summary = "Admin: reset a user's password and send email notification")
    public ApiResponse<Void> adminResetPassword(
            @RequestHeader(value = "X-User-Role", required = false) String callerRole,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID callerTenantId,
            @PathVariable UUID id,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String newPassword = body != null ? body.get("newPassword") : null;
        authService.adminResetPassword(callerRole, callerTenantId, id, newPassword);
        return ApiResponse.ok(null, "Password reset successfully. An email has been sent to the user.");
    }

    /** Extract real client IP — respects X-Forwarded-For and X-Real-IP from nginx. */
    static String extractIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String xri = req.getHeader("X-Real-IP");
        if (xri != null && !xri.isBlank()) return xri.trim();
        return req.getRemoteAddr();
    }
}
