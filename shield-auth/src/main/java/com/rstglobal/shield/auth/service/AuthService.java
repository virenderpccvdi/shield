package com.rstglobal.shield.auth.service;

import com.rstglobal.shield.auth.client.AuditClient;
import com.rstglobal.shield.auth.client.NotificationClient;
import com.rstglobal.shield.auth.dto.request.*;
import com.rstglobal.shield.auth.dto.response.AuthResponse;
import com.rstglobal.shield.auth.dto.response.UserResponse;
import com.rstglobal.shield.auth.entity.User;
import com.rstglobal.shield.auth.entity.UserRole;
import com.rstglobal.shield.auth.repository.UserRepository;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.common.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String REFRESH_PREFIX    = "shield:auth:refresh:";
    private static final String OTP_PREFIX        = "shield:auth:otp:";
    private static final String BLACKLIST_PREFIX  = "shield:auth:blacklist:";
    private static final int    MAX_FAIL_ATTEMPTS = 5;
    private static final int    LOCK_MINUTES      = 30;

    private final UserRepository      userRepository;
    private final PasswordEncoder     passwordEncoder;
    private final JwtUtils            jwtUtils;
    private final StringRedisTemplate redis;
    private final AuditClient         auditClient;
    private final MfaService          mfaService;
    private final NotificationClient  notificationClient;

    @Value("${shield.jwt.refresh-days:30}")
    private long refreshDays;

    @Value("${shield.jwt.expiry-hours:1}")
    private long expiryHours;

    // ── Register ─────────────────────────────────────────────────────────────

    @Transactional
    public UserResponse register(RegisterRequest req, UserRole role) {
        return register(req, role, null);
    }

    @Transactional
    public UserResponse register(RegisterRequest req, UserRole role, String ipAddress) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw ShieldException.conflict("Email already registered");
        }
        User user = User.builder()
                .email(req.getEmail().toLowerCase())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .phone(req.getPhone())
                .role(role)
                .build();
        user.setTenantId(req.getTenantId());
        user = userRepository.save(user);
        log.info("Registered user {} with role {}", user.getId(), role);
        auditClient.log("USER_REGISTERED", "User", user.getId().toString(),
                user.getId(), user.getName(), ipAddress,
                Map.of("email", user.getEmail(), "role", role.name()));
        return toUserResponse(user);
    }

    /**
     * Admin-initiated registration: same as register() but also generates a
     * password-reset OTP (valid 24 h) and sends a welcome email with a setup link.
     */
    @Transactional
    public UserResponse adminRegister(RegisterRequest req, UserRole role) {
        UserResponse response = register(req, role);

        // Generate a 24-hour OTP (used for password-setup link if needed)
        UUID userId = response.getId();
        String otp  = String.valueOf((int)(Math.random() * 900000) + 100000);
        redis.opsForValue().set(OTP_PREFIX + userId, otp, 24, TimeUnit.HOURS);

        // Fire-and-forget welcome email: include the plaintext password so user can login immediately
        notificationClient.sendWelcomeEmail(userId, response.getEmail(), response.getName(),
                role.name(), otp, req.getPassword());

        log.info("Admin-created user {} — welcome email dispatched", userId);
        return response;
    }

    /**
     * Admin-initiated password reset: ISP_ADMIN can reset CUSTOMER passwords in their tenant;
     * GLOBAL_ADMIN can reset any user's password.
     * Sends an email to the user with the new password.
     */
    @Transactional
    public void adminResetPassword(String callerRole, UUID callerTenantId, UUID targetUserId, String newPassword) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> ShieldException.notFound("User", targetUserId));

        // Authorization check
        if ("ISP_ADMIN".equals(callerRole)) {
            if (target.getRole() != UserRole.CUSTOMER) {
                throw ShieldException.forbidden("ISP_ADMIN can only reset CUSTOMER passwords");
            }
            if (callerTenantId == null || !callerTenantId.equals(target.getTenantId())) {
                throw ShieldException.forbidden("Cannot reset password for customer in a different tenant");
            }
        } else if (!"GLOBAL_ADMIN".equals(callerRole)) {
            throw ShieldException.forbidden("Admin role required");
        }

        // Generate random password if not provided
        if (newPassword == null || newPassword.isBlank()) {
            newPassword = generateRandomPassword();
        }

        target.setPasswordHash(passwordEncoder.encode(newPassword));
        target.setFailedLoginAttempts(0);
        target.setLockedUntil(null);
        userRepository.save(target);

        // Send email notification with new password
        notificationClient.sendAdminPasswordResetEmail(target.getEmail(), target.getName(), newPassword);
        log.info("Admin reset password for user {} (role={})", targetUserId, target.getRole());
    }

    private static String generateRandomPassword() {
        String upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lower = "abcdefghijklmnopqrstuvwxyz";
        String digits = "0123456789";
        String special = "!@#$%&*";
        String all = upper + lower + digits + special;
        StringBuilder pw = new StringBuilder();
        pw.append(upper.charAt((int)(Math.random() * upper.length())));
        pw.append(lower.charAt((int)(Math.random() * lower.length())));
        pw.append(digits.charAt((int)(Math.random() * digits.length())));
        pw.append(special.charAt((int)(Math.random() * special.length())));
        for (int i = 4; i < 12; i++) pw.append(all.charAt((int)(Math.random() * all.length())));
        // Shuffle
        char[] chars = pw.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = (int)(Math.random() * (i + 1));
            char tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
        }
        return new String(chars);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest req) {
        return login(req, null);
    }

    @Transactional
    public AuthResponse login(LoginRequest req, String ipAddress) {
        User user = userRepository.findByEmail(req.getEmail().toLowerCase())
                .orElseThrow(() -> new ShieldException("UNAUTHORIZED", "Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (!user.isActive()) {
            throw ShieldException.forbidden("Account is disabled");
        }

        if (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil())) {
            throw new ShieldException("TOO_MANY_REQUESTS",
                    "Account temporarily locked. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            int attempts  = user.getFailedLoginAttempts() + 1;
            Instant lockUntil = attempts >= MAX_FAIL_ATTEMPTS
                    ? Instant.now().plus(LOCK_MINUTES, ChronoUnit.MINUTES) : null;
            userRepository.incrementFailedAttempts(user.getId(), lockUntil);
            throw new ShieldException("UNAUTHORIZED", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

        userRepository.resetLoginState(user.getId(), Instant.now());

        // ── MFA check ─────────────────────────────────────────────────────
        if (user.isMfaEnabled()) {
            String mfaToken = mfaService.createMfaToken(user.getId());
            log.info("MFA required for user {} — issuing mfaToken", user.getId());
            return AuthResponse.builder()
                    .mfaRequired(true)
                    .mfaToken(mfaToken)
                    .userId(user.getId())
                    .email(user.getEmail())
                    .name(user.getName())
                    .role(user.getRole().name())
                    .build();
        }

        String access  = jwtUtils.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name(), user.getTenantId());
        String refresh = UUID.randomUUID().toString();

        redis.opsForValue().set(REFRESH_PREFIX + refresh, user.getId().toString(), refreshDays, TimeUnit.DAYS);

        auditClient.log("USER_LOGIN", "User", user.getId().toString(),
                user.getId(), user.getName(), ipAddress,
                Map.of("email", user.getEmail(), "role", user.getRole().name()));

        return buildAuthResponse(user, access, refresh);
    }

    // ── MFA Validate (step 2 of MFA login) ──────────────────────────────────

    @Transactional
    public AuthResponse completeMfaLogin(String mfaToken, String code) {
        UUID userId = mfaService.validateMfaLogin(mfaToken, code);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ShieldException("UNAUTHORIZED", "User not found", HttpStatus.UNAUTHORIZED));

        String access  = jwtUtils.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name(), user.getTenantId());
        String refresh = UUID.randomUUID().toString();

        redis.opsForValue().set(REFRESH_PREFIX + refresh, user.getId().toString(), refreshDays, TimeUnit.DAYS);

        auditClient.log("USER_LOGIN_MFA", "User", user.getId().toString(),
                user.getId(), user.getName(), null,
                Map.of("email", user.getEmail(), "role", user.getRole().name(), "mfa", "true"));

        return buildAuthResponse(user, access, refresh);
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse refresh(RefreshRequest req) {
        String key    = REFRESH_PREFIX + req.getRefreshToken();
        String userId = redis.opsForValue().get(key);
        if (userId == null) {
            throw new ShieldException("UNAUTHORIZED", "Refresh token expired or invalid", HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new ShieldException("UNAUTHORIZED", "User not found", HttpStatus.UNAUTHORIZED));

        if (!user.isActive()) {
            throw ShieldException.forbidden("Account is disabled");
        }

        redis.delete(key);
        String newRefresh = UUID.randomUUID().toString();
        redis.opsForValue().set(REFRESH_PREFIX + newRefresh, user.getId().toString(), refreshDays, TimeUnit.DAYS);

        String access = jwtUtils.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name(), user.getTenantId());

        return buildAuthResponse(user, access, newRefresh);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Revokes the refresh token AND blacklists all access tokens for this user
     * that were issued before now. The blacklist TTL matches the access token
     * expiry so Redis auto-expires it when it can no longer matter.
     */
    public void logout(UUID userId, String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            redis.delete(REFRESH_PREFIX + refreshToken);
        }
        if (userId != null) {
            // Any access token with iat <= this epoch second is now invalid
            redis.opsForValue().set(
                    BLACKLIST_PREFIX + userId,
                    String.valueOf(Instant.now().getEpochSecond()),
                    expiryHours, TimeUnit.HOURS);
            log.info("Access tokens blacklisted for userId={}", userId);
            auditClient.log("USER_LOGOUT", "User", userId.toString(),
                    userId, null, null, Map.of());
        }
    }

    // ── Forgot / Reset password ───────────────────────────────────────────────

    @Transactional
    public void forgotPassword(ForgotPasswordRequest req) {
        userRepository.findByEmail(req.getEmail().toLowerCase()).ifPresent(user -> {
            String otp = String.valueOf((int)(Math.random() * 900000) + 100000);
            redis.opsForValue().set(OTP_PREFIX + user.getId(), otp, 15, TimeUnit.MINUTES);
            notificationClient.sendPasswordResetOtpEmail(user.getId(), user.getEmail(), user.getName(), otp);
            log.info("Password reset OTP generated and email dispatched for user {}", user.getId());
        });
        // Always return 200 — prevents email enumeration
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        UUID   userId;
        String otp;

        if (req.getToken() != null && !req.getToken().isBlank()) {
            // Link-based flow: token = Base64(userId:otp)
            String decoded;
            try {
                decoded = new String(java.util.Base64.getDecoder().decode(req.getToken()));
            } catch (Exception e) {
                throw ShieldException.badRequest("Invalid reset token");
            }
            String[] parts = decoded.split(":", 2);
            if (parts.length != 2) throw ShieldException.badRequest("Invalid reset token");
            userId = UUID.fromString(parts[0]);
            otp    = parts[1];
        } else if (req.getEmail() != null && req.getCode() != null) {
            // In-app flow: email + code
            User u = userRepository.findByEmail(req.getEmail().toLowerCase())
                    .orElseThrow(() -> ShieldException.badRequest("Invalid email or code"));
            userId = u.getId();
            otp    = req.getCode().trim();
        } else {
            throw ShieldException.badRequest("Provide either a reset token or email + code");
        }

        String stored = redis.opsForValue().get(OTP_PREFIX + userId);
        if (stored == null || !stored.equals(otp)) {
            throw ShieldException.badRequest("Reset code expired or invalid");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
        redis.delete(OTP_PREFIX + userId);
        log.info("Password reset completed for user {}", userId);
    }

    // ── Change password ───────────────────────────────────────────────────────

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw ShieldException.badRequest("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
        auditClient.log("PASSWORD_CHANGED", "User", userId.toString(),
                userId, user.getName(), null, Map.of("email", user.getEmail()));
    }

    // ── List users (admin) ────────────────────────────────────────────────────

    public Page<UserResponse> listUsers(int page, int size, String role) {
        PageRequest pr = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<User> users = (role != null && !role.isBlank())
                ? userRepository.findAll(
                    (root, q, cb) -> cb.equal(root.get("role"), UserRole.valueOf(role)), pr)
                : userRepository.findAll(pr);
        return users.map(this::toUserResponse);
    }

    // ── Get current user ──────────────────────────────────────────────────────

    public UserResponse getMe(UUID userId) {
        return userRepository.findById(userId)
                .map(this::toUserResponse)
                .orElseThrow(() -> ShieldException.notFound("User", userId));
    }

    // ── Update profile ────────────────────────────────────────────────────────

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        if (req.getName() != null && !req.getName().isBlank()) {
            user.setName(req.getName().trim());
        }
        if (req.getPhone() != null) {
            user.setPhone(req.getPhone().isBlank() ? null : req.getPhone().trim());
        }
        user = userRepository.save(user);
        log.info("Profile updated for user {}", userId);
        auditClient.log("PROFILE_UPDATED", "User", userId.toString(),
                userId, user.getName(), null,
                Map.of("name", user.getName(), "phone", user.getPhone() != null ? user.getPhone() : ""));
        return toUserResponse(user);
    }

    // ── Admin user management ────────────────────────────────────────────────

    @Transactional
    public UserResponse adminUpdateUser(UUID userId, Map<String, Object> updates) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));
        if (updates.containsKey("name")) {
            String name = String.valueOf(updates.get("name")).trim();
            if (!name.isBlank()) user.setName(name);
        }
        if (updates.containsKey("phone")) {
            String phone = String.valueOf(updates.get("phone")).trim();
            user.setPhone(phone.isBlank() ? null : phone);
        }
        if (updates.containsKey("role")) {
            String roleStr = String.valueOf(updates.get("role")).toUpperCase();
            user.setRole(UserRole.valueOf(roleStr));
        }
        if (updates.containsKey("active")) {
            user.setActive(Boolean.parseBoolean(String.valueOf(updates.get("active"))));
        }
        if (updates.containsKey("tenantId")) {
            Object tid = updates.get("tenantId");
            if (tid == null || String.valueOf(tid).isBlank()) {
                user.setTenantId(null);
            } else {
                try { user.setTenantId(UUID.fromString(String.valueOf(tid))); }
                catch (IllegalArgumentException ignored) {}
            }
        }
        user = userRepository.save(user);
        auditClient.log("USER_UPDATED", "User", userId.toString(),
                userId, user.getName(), null, updates);
        return toUserResponse(user);
    }

    @Transactional
    public void adminDeleteUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));
        userRepository.delete(user);
        auditClient.log("USER_DELETED", "User", userId.toString(),
                userId, user.getName(), null, Map.of("email", user.getEmail()));
    }

    // ── Child Token ─────────────────────────────────────────────────────────

    /**
     * Issues a limited-scope JWT for a child device app.
     * Validates that the parentUserId owns the child profile by checking the
     * user exists and has CUSTOMER role, then issues a child token via JwtUtils.
     */
    public AuthResponse issueChildToken(UUID parentUserId, UUID childProfileId, String pin) {
        User parent = userRepository.findById(parentUserId)
                .orElseThrow(() -> new ShieldException("UNAUTHORIZED", "Parent user not found", HttpStatus.UNAUTHORIZED));

        if (!parent.isActive()) {
            throw ShieldException.forbidden("Parent account is disabled");
        }
        if (parent.getRole() != UserRole.CUSTOMER) {
            throw ShieldException.forbidden("Only CUSTOMER users can issue child tokens");
        }

        // Validate PIN (default child PIN is "0000" if not customised)
        // In production this would be stored per-profile; for now accept any 4-digit PIN
        if (pin == null || pin.length() < 4) {
            throw ShieldException.badRequest("Invalid PIN");
        }

        String childToken = jwtUtils.generateChildToken(childProfileId, parentUserId, parent.getTenantId());

        log.info("Issued child token for profileId={} parentId={}", childProfileId, parentUserId);
        auditClient.log("CHILD_TOKEN_ISSUED", "ChildProfile", childProfileId.toString(),
                parentUserId, parent.getName(), null,
                Map.of("profileId", childProfileId.toString()));

        return AuthResponse.builder()
                .accessToken(childToken)
                .refreshToken(null)
                .tokenType("Bearer")
                .expiresIn(365 * 86400L)
                .userId(parentUserId)
                .email(parent.getEmail())
                .name(parent.getName())
                .role("CHILD_APP")
                .tenantId(parent.getTenantId())
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiryHours * 3600L)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .tenantId(user.getTenantId())
                .build();
    }

    private UserResponse toUserResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .email(u.getEmail())
                .name(u.getName())
                .phone(u.getPhone())
                .role(u.getRole().name())
                .tenantId(u.getTenantId())
                .emailVerified(u.isEmailVerified())
                .active(u.isActive())
                .mfaEnabled(u.isMfaEnabled())
                .lastLoginAt(u.getLastLoginAt())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
