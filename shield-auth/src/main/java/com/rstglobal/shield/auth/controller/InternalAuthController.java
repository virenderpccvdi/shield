package com.rstglobal.shield.auth.controller;

import com.rstglobal.shield.auth.dto.request.AdminRegisterRequest;
import com.rstglobal.shield.auth.dto.response.UserResponse;
import com.rstglobal.shield.auth.entity.User;
import com.rstglobal.shield.auth.entity.UserRole;
import com.rstglobal.shield.auth.repository.UserRepository;
import com.rstglobal.shield.auth.service.AuthService;
import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Internal service-to-service endpoints for the auth service.
 * These endpoints are NOT exposed through the public API gateway — they are only
 * accessible from within the cluster (e.g., shield-tenant calling bulk import).
 *
 * Security: permitted via SecurityConfig (/internal/**) — no JWT needed.
 */
@Slf4j
@RestController
@RequestMapping("/internal/users")
@RequiredArgsConstructor
@Tag(name = "Internal Auth", description = "Service-to-service user management endpoints")
public class InternalAuthController {

    private final AuthService     authService;
    private final UserRepository  userRepository;

    /**
     * Create a CUSTOMER account for bulk import.
     *
     * Request body: { email, name, phone?, tenantId, role }
     *
     * - If email already exists: returns 409 Conflict (ShieldException.conflict).
     *   The caller (BulkImportService) catches this and skips the row.
     * - If created: generates a random initial password, sends a welcome email,
     *   and returns 201 Created with { userId, email, created: true }.
     */
    @PostMapping("/create-customer")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Internal: create a CUSTOMER user (used by bulk import)")
    public ApiResponse<Map<String, Object>> createCustomer(
            @RequestBody Map<String, Object> body) {

        String email    = getString(body, "email");
        String name     = getString(body, "name");
        String phone    = getString(body, "phone");
        String tenantId = getString(body, "tenantId");
        String roleStr  = getString(body, "role");

        if (email == null || email.isBlank()) {
            throw ShieldException.badRequest("email is required");
        }

        // Check for existing user — return 409 so the caller can handle idempotency
        Optional<User> existing = userRepository.findByEmail(email.toLowerCase());
        if (existing.isPresent()) {
            log.debug("Internal create-customer: email already exists — {}", email);
            throw ShieldException.conflict("Email already registered: " + email);
        }

        // Determine role (default CUSTOMER)
        UserRole role = UserRole.CUSTOMER;
        if (roleStr != null && !roleStr.isBlank()) {
            try {
                role = UserRole.valueOf(roleStr.toUpperCase());
            } catch (IllegalArgumentException ignored) {
                role = UserRole.CUSTOMER;
            }
        }

        // Generate a random initial password — user will receive it via welcome email
        String initialPassword = generateRandomPassword();

        AdminRegisterRequest req = new AdminRegisterRequest();
        req.setEmail(email.trim().toLowerCase());
        req.setPassword(initialPassword);
        req.setName(name != null && !name.isBlank() ? name.trim() : email.split("@")[0]);
        req.setPhone(phone);
        req.setTenantId(tenantId != null && !tenantId.isBlank() ? UUID.fromString(tenantId) : null);
        req.setRole(role.name());

        UserResponse created = authService.adminRegister(req, role);

        log.info("Internal create-customer: userId={} email={} tenantId={}",
                created.getId(), created.getEmail(), tenantId);

        return ApiResponse.ok(
                Map.of(
                    "userId",  created.getId().toString(),
                    "email",   created.getEmail(),
                    "created", true
                ),
                "User created successfully"
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String getString(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : null;
    }

    private static String generateRandomPassword() {
        String upper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lower   = "abcdefghijklmnopqrstuvwxyz";
        String digits  = "0123456789";
        String special = "!@#$%&*";
        String all     = upper + lower + digits + special;
        StringBuilder pw = new StringBuilder();
        pw.append(upper.charAt((int) (Math.random() * upper.length())));
        pw.append(lower.charAt((int) (Math.random() * lower.length())));
        pw.append(digits.charAt((int) (Math.random() * digits.length())));
        pw.append(special.charAt((int) (Math.random() * special.length())));
        for (int i = 4; i < 12; i++) pw.append(all.charAt((int) (Math.random() * all.length())));
        // Shuffle
        char[] chars = pw.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = (int) (Math.random() * (i + 1));
            char tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
        }
        return new String(chars);
    }
}
