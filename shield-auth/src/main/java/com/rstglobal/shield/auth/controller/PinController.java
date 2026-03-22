package com.rstglobal.shield.auth.controller;

import com.rstglobal.shield.auth.entity.User;
import com.rstglobal.shield.auth.repository.UserRepository;
import com.rstglobal.shield.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

/**
 * PO-01: App PIN Lock endpoints.
 * All requests require X-User-Id header (injected by API Gateway after JWT validation).
 */
@RestController
@RequestMapping("/api/v1/auth/pin")
@RequiredArgsConstructor
@Tag(name = "PIN Lock", description = "Parent app PIN lock management")
public class PinController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    // ── DTOs ──────────────────────────────────────────────────────────────────

    @Data
    public static class SetPinRequest {
        @NotBlank @Size(min = 4, max = 8, message = "PIN must be 4–8 digits")
        private String pin;
    }

    @Data
    public static class VerifyPinRequest {
        @NotBlank
        private String pin;
    }

    @Data
    public static class BiometricRequest {
        @NotNull
        private Boolean enabled;
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/auth/pin/set
     * BCrypt-hash the PIN and save it; sets pinEnabled=true.
     */
    @PostMapping("/set")
    @Operation(summary = "Set or update app PIN")
    public ApiResponse<Void> setPin(
            @Valid @RequestBody SetPinRequest req,
            @RequestHeader("X-User-Id") String userId) {

        User user = findUser(userId);
        user.setAppPin(passwordEncoder.encode(req.getPin()));
        user.setPinEnabled(true);
        userRepository.save(user);
        return ApiResponse.ok(null, "PIN set successfully.");
    }

    /**
     * POST /api/v1/auth/pin/verify
     * Returns { valid: true } if PIN matches, { valid: false } otherwise.
     */
    @PostMapping("/verify")
    @Operation(summary = "Verify app PIN")
    public ApiResponse<Map<String, Boolean>> verifyPin(
            @Valid @RequestBody VerifyPinRequest req,
            @RequestHeader("X-User-Id") String userId) {

        User user = findUser(userId);
        if (!user.isPinEnabled() || user.getAppPin() == null) {
            return ApiResponse.ok(Map.of("valid", false), "No PIN configured.");
        }
        boolean valid = passwordEncoder.matches(req.getPin(), user.getAppPin());
        return ApiResponse.ok(Map.of("valid", valid));
    }

    /**
     * PUT /api/v1/auth/pin/biometric
     * Toggle biometric unlock flag.
     */
    @PutMapping("/biometric")
    @Operation(summary = "Enable or disable biometric unlock")
    public ApiResponse<Void> setBiometric(
            @Valid @RequestBody BiometricRequest req,
            @RequestHeader("X-User-Id") String userId) {

        User user = findUser(userId);
        user.setBiometricEnabled(req.getEnabled());
        userRepository.save(user);
        String msg = Boolean.TRUE.equals(req.getEnabled()) ? "Biometric unlock enabled." : "Biometric unlock disabled.";
        return ApiResponse.ok(null, msg);
    }

    /**
     * GET /api/v1/auth/pin/settings
     * Returns current PIN and biometric settings.
     */
    @GetMapping("/settings")
    @Operation(summary = "Get PIN lock settings")
    public ApiResponse<Map<String, Boolean>> getSettings(
            @RequestHeader("X-User-Id") String userId) {

        User user = findUser(userId);
        return ApiResponse.ok(Map.of(
            "pinEnabled", user.isPinEnabled(),
            "biometricEnabled", user.isBiometricEnabled()
        ));
    }

    /**
     * DELETE /api/v1/auth/pin/remove
     * Clears the PIN hash and disables PIN lock.
     */
    @DeleteMapping("/remove")
    @Operation(summary = "Remove app PIN")
    public ApiResponse<Void> removePin(
            @RequestHeader("X-User-Id") String userId) {

        User user = findUser(userId);
        user.setAppPin(null);
        user.setPinEnabled(false);
        userRepository.save(user);
        return ApiResponse.ok(null, "PIN removed.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User findUser(String userId) {
        UUID id;
        try {
            id = UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid X-User-Id header.");
        }
        return userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }
}
