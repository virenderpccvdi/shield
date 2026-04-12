package com.rstglobal.shield.auth.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rstglobal.shield.auth.client.AuditClient;
import com.rstglobal.shield.auth.client.NotificationClient;
import com.rstglobal.shield.auth.dto.request.*;
import com.rstglobal.shield.auth.dto.response.AuthResponse;
import com.rstglobal.shield.auth.dto.response.SessionResponse;
import com.rstglobal.shield.auth.dto.response.UserResponse;
import com.rstglobal.shield.auth.entity.Session;
import com.rstglobal.shield.auth.entity.User;
import com.rstglobal.shield.auth.entity.UserRole;
import com.rstglobal.shield.auth.entity.PasswordHistory;
import com.rstglobal.shield.auth.repository.PasswordHistoryRepository;
import com.rstglobal.shield.auth.repository.SessionRepository;
import com.rstglobal.shield.auth.repository.UserRepository;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.common.security.JwtUtils;
import java.security.SecureRandom;
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

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    // Use SecureRandom for all OTP/PIN/password generation — Math.random() is
    // predictable and enables account takeover via OTP guessing.
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final String REFRESH_PREFIX    = "shield:auth:refresh:";
    private static final String OTP_PREFIX        = "shield:auth:otp:";
    private static final String BLACKLIST_PREFIX  = "shield:auth:blacklist:";
    private static final String FAILURES_PREFIX   = "shield:auth:failures:";
    private static final String INVITE_PREFIX     = "shield:auth:invite:";
    private static final int    MAX_FAIL_ATTEMPTS = 5;
    private static final int    LOCK_MINUTES      = 30;
    private static final int    RATE_LOCK_MINUTES = 15;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final UserRepository             userRepository;
    private final SessionRepository          sessionRepository;
    private final PasswordHistoryRepository  passwordHistoryRepository;
    private final PasswordEncoder            passwordEncoder;
    private final JwtUtils                   jwtUtils;
    private final StringRedisTemplate        redis;
    private final AuditClient                auditClient;
    private final MfaService                 mfaService;
    private final NotificationClient         notificationClient;

    @Value("${shield.jwt.refresh-days:30}")
    private long refreshDays;

    @Value("${shield.jwt.expiry-hours:1}")
    private long expiryHours;

    /** DIRECT tenant UUID — assigned to self-registered users with no ISP affiliation.
     *  Ensures tenantId is never null, preventing feature-gate bypass. */
    @Value("${shield.direct-tenant-id:00000000-0000-0000-0000-000000000001}")
    private UUID directTenantId;

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

        // Resolve invite token — if present, override tenantId and role from the stored invite
        if (req.getInviteToken() != null && !req.getInviteToken().isBlank()) {
            String inviteJson = redis.opsForValue().get(INVITE_PREFIX + req.getInviteToken());
            if (inviteJson == null) {
                throw ShieldException.badRequest("Invite token is invalid or has expired");
            }
            try {
                Map<String, String> invite = OBJECT_MAPPER.readValue(
                        inviteJson, new TypeReference<Map<String, String>>() {});
                if (invite.containsKey("tenantId")) {
                    req.setTenantId(UUID.fromString(invite.get("tenantId")));
                }
                role = UserRole.CO_PARENT;
                // Consume the invite token so it cannot be reused
                redis.delete(INVITE_PREFIX + req.getInviteToken());
                log.info("Invite token consumed for email={} tenantId={}", req.getEmail(), req.getTenantId());
            } catch (Exception e) {
                throw ShieldException.badRequest("Invite token is malformed");
            }
        }

        User user = User.builder()
                .email(req.getEmail().toLowerCase())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .phone(req.getPhone())
                .role(role)
                .build();
        // Never leave tenantId null for CUSTOMER role — null bypasses all feature gates.
        // Assign DIRECT tenant (STARTER plan) for self-registered users with no ISP affiliation.
        UUID tenantId = req.getTenantId();
        if (tenantId == null && role == UserRole.CUSTOMER) {
            tenantId = directTenantId;
        }
        user.setTenantId(tenantId);
        user = userRepository.save(user);
        log.info("Registered user {} with role {}", user.getId(), role);
        auditClient.log("USER_REGISTERED", "User", user.getId().toString(),
                user.getId(), user.getName(), ipAddress,
                Map.of("email", user.getEmail(), "role", role.name()));

        // Send verification email for self-service registrations (emailVerified defaults to false)
        final UUID newUserId = user.getId();
        final String newUserEmail = user.getEmail();
        final String newUserName  = user.getName();
        String otp = String.valueOf((int)(Math.random() * 900000) + 100000);
        redis.opsForValue().set(OTP_PREFIX + "verif:" + newUserId, otp, 24, TimeUnit.HOURS);
        notificationClient.sendEmailVerificationOtp(newUserId, newUserEmail, newUserName, otp);

        return toUserResponse(user);
    }

    /**
     * Admin-initiated registration: same as register() but also generates a
     * password-reset OTP (valid 24 h) and sends a welcome email with a setup link.
     */
    @Transactional
    public UserResponse adminRegister(RegisterRequest req, UserRole role) {
        UserResponse response = register(req, role);

        // Mark admin-created users as pre-verified so they can log in immediately
        // after they have set their password via the setup link.
        UUID userId = response.getId();
        userRepository.findById(userId).ifPresent(u -> {
            u.setEmailVerified(true);
            userRepository.save(u);
        });

        // Generate a 24-hour OTP for the password-setup link
        String otp = String.valueOf((int)(Math.random() * 900000) + 100000);
        redis.opsForValue().set(OTP_PREFIX + userId, otp, 24, TimeUnit.HOURS);

        // Fire-and-forget welcome email: send setup link only — no plaintext password
        notificationClient.sendWelcomeEmail(userId, response.getEmail(), response.getName(),
                role.name(), otp);

        log.info("Admin-created user {} — welcome email with setup link dispatched", userId);
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
        return login(req, null, null);
    }

    @Transactional
    public AuthResponse login(LoginRequest req, String ipAddress) {
        return login(req, ipAddress, null);
    }

    // Dummy hash used to run bcrypt even when the email doesn't exist,
    // ensuring constant-time response and preventing user enumeration.
    private static final String DUMMY_HASH =
        "$2b$12$8K1p/a0dR1xqM2LnvwBFMeS5DJmN3oZ7rL0vXkYtP4hGcQmUA8iwq";

    @Transactional
    public AuthResponse login(LoginRequest req, String ipAddress, String userAgent) {
        String email = req.getEmail().toLowerCase();

        // Redis-based brute-force protection: track failures per email with a 15-min sliding window.
        // Check before hitting the DB so locked-out requests fail fast.
        String failKey = FAILURES_PREFIX + email;
        String failCountStr = redis.opsForValue().get(failKey);
        int redisFailCount = failCountStr != null ? Integer.parseInt(failCountStr) : 0;
        if (redisFailCount >= MAX_FAIL_ATTEMPTS) {
            throw new ShieldException("TOO_MANY_REQUESTS",
                    "Too many failed attempts. Try again in 15 minutes.", HttpStatus.TOO_MANY_REQUESTS);
        }

        java.util.Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            // Always run bcrypt to prevent timing-based user enumeration attacks
            passwordEncoder.matches(req.getPassword(), DUMMY_HASH);
            // Increment Redis failure counter even for non-existent emails to prevent enumeration
            Long newCount = redis.opsForValue().increment(failKey);
            if (newCount != null && newCount == 1) {
                redis.expire(failKey, RATE_LOCK_MINUTES, TimeUnit.MINUTES);
            }
            throw new ShieldException("UNAUTHORIZED", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }
        User user = userOpt.get();

        if (!user.isActive()) {
            throw ShieldException.forbidden("Account is disabled");
        }

        if (!user.isEmailVerified()) {
            throw ShieldException.badRequest("Please verify your email address before logging in.");
        }

        if (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil())) {
            throw new ShieldException("TOO_MANY_REQUESTS",
                    "Account temporarily locked. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            // Increment Redis failure counter
            Long newCount = redis.opsForValue().increment(failKey);
            if (newCount != null && newCount == 1) {
                redis.expire(failKey, RATE_LOCK_MINUTES, TimeUnit.MINUTES);
            }
            int attempts  = user.getFailedLoginAttempts() + 1;
            Instant lockUntil = attempts >= MAX_FAIL_ATTEMPTS
                    ? Instant.now().plus(LOCK_MINUTES, ChronoUnit.MINUTES) : null;
            userRepository.incrementFailedAttempts(user.getId(), lockUntil);
            throw new ShieldException("UNAUTHORIZED", "Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

        // Successful login — clear the Redis failure counter and DB lock state
        redis.delete(failKey);
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
        // Track current active refresh token per userId for revocation support
        redis.opsForValue().set(REFRESH_PREFIX + "user:" + user.getId(), refresh, refreshDays, TimeUnit.DAYS);

        // Create session record with device info and fingerprint
        createSessionWithFingerprint(user, userAgent, ipAddress);

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
        // Track current active refresh token per userId for revocation support
        redis.opsForValue().set(REFRESH_PREFIX + "user:" + user.getId(), refresh, refreshDays, TimeUnit.DAYS);

        // Create session for MFA-completed login (no userAgent/IP available here)
        createSessionWithFingerprint(user, null, null);

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

        // Invalidate old refresh token immediately (rotation)
        redis.delete(key);

        // Generate and store new refresh token
        String newRefresh = UUID.randomUUID().toString();
        redis.opsForValue().set(REFRESH_PREFIX + newRefresh, user.getId().toString(), refreshDays, TimeUnit.DAYS);

        // Track the current active refresh token per userId for family-wide revocation
        redis.opsForValue().set(REFRESH_PREFIX + "user:" + user.getId(), newRefresh, refreshDays, TimeUnit.DAYS);

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
            String otp = String.valueOf(SECURE_RANDOM.nextInt(900000) + 100000);
            // OTP valid for 60 minutes (was 15 min — too short for users checking
            // email on a different device). Stored in Redis with auto-expiry.
            redis.opsForValue().set(OTP_PREFIX + user.getId(), otp, 60, TimeUnit.MINUTES);
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
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);
        redis.delete(OTP_PREFIX + userId);
        log.info("Password reset completed for user {}", userId);
    }

    // ── Email Verification ────────────────────────────────────────────────────

    /**
     * Sends a verification OTP to the given user's email address.
     * Call this after self-service registration to trigger the verification flow.
     */
    @Transactional
    public void sendVerificationEmail(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));
        if (user.isEmailVerified()) return; // already verified — no-op
        String otp = String.valueOf((int)(Math.random() * 900000) + 100000);
        redis.opsForValue().set(OTP_PREFIX + "verif:" + userId, otp, 24, TimeUnit.HOURS);
        notificationClient.sendEmailVerificationOtp(userId, user.getEmail(), user.getName(), otp);
        log.info("Email verification OTP dispatched for user {}", userId);
    }

    /**
     * Verifies the user's email using either a Base64 token (userId:otp) or
     * an email + code pair.  Sets emailVerified = true on success.
     */
    @Transactional
    public void verifyEmail(String token, String email, String code) {
        UUID   userId;
        String otp;

        if (token != null && !token.isBlank()) {
            String decoded;
            try {
                decoded = new String(java.util.Base64.getDecoder().decode(token));
            } catch (Exception e) {
                throw ShieldException.badRequest("Invalid verification token");
            }
            String[] parts = decoded.split(":", 2);
            if (parts.length != 2) throw ShieldException.badRequest("Invalid verification token");
            userId = UUID.fromString(parts[0]);
            otp    = parts[1];
        } else if (email != null && code != null) {
            User u = userRepository.findByEmail(email.toLowerCase())
                    .orElseThrow(() -> ShieldException.badRequest("Invalid email or code"));
            userId = u.getId();
            otp    = code.trim();
        } else {
            throw ShieldException.badRequest("Provide either a verification token or email + code");
        }

        String stored = redis.opsForValue().get(OTP_PREFIX + "verif:" + userId);
        if (stored == null || !stored.equals(otp)) {
            throw ShieldException.badRequest("Verification code expired or invalid");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        user.setEmailVerified(true);
        userRepository.save(user);
        redis.delete(OTP_PREFIX + "verif:" + userId);
        log.info("Email verified for user {}", userId);
    }

    // ── Change password ───────────────────────────────────────────────────────

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw ShieldException.badRequest("Current password is incorrect");
        }

        // AU10: Check against last 5 passwords (including the current one stored in DB)
        List<PasswordHistory> history =
                passwordHistoryRepository.findTop5ByUserIdOrderByCreatedAtDesc(userId);
        for (PasswordHistory h : history) {
            if (passwordEncoder.matches(req.getNewPassword(), h.getPasswordHash())) {
                throw ShieldException.badRequest("Cannot reuse one of your last 5 passwords");
            }
        }
        // Also check against the current password hash stored on the user record
        if (passwordEncoder.matches(req.getNewPassword(), user.getPasswordHash())) {
            throw ShieldException.badRequest("New password must be different from your current password");
        }

        String encodedNewPassword = passwordEncoder.encode(req.getNewPassword());
        user.setPasswordHash(encodedNewPassword);
        userRepository.save(user);

        // Record the new password in history, then prune to keep only the last 5
        passwordHistoryRepository.save(new PasswordHistory(userId, encodedNewPassword));
        passwordHistoryRepository.deleteOldEntries(userId, 5);

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

    // ── Co-parent Invite ─────────────────────────────────────────────────────

    /**
     * Generates a co-parent invite token and sends an invite email to the given address.
     *
     * The token is stored in Redis with a 7-day TTL:
     *   shield:auth:invite:{token} → {"tenantId": "...", "inviterUserId": "...", "role": "CO_PARENT"}
     *
     * When the invitee registers with ?inviteToken={token}, the register() method automatically:
     *   - assigns CO_PARENT role
     *   - links to the inviter's tenant
     *   - deletes the invite token (single-use)
     */
    public void sendCoParentInvite(UUID inviterUserId, CoParentInviteRequest req) {
        // Generate a random invite token
        String token = UUID.randomUUID().toString().replace("-", "") +
                       UUID.randomUUID().toString().replace("-", "");

        // Build the payload stored in Redis
        Map<String, String> inviteData = Map.of(
                "tenantId",      req.getTenantId() != null ? req.getTenantId().toString() : "",
                "inviterUserId", inviterUserId.toString(),
                "role",          "CO_PARENT"
        );
        try {
            String json = OBJECT_MAPPER.writeValueAsString(inviteData);
            redis.opsForValue().set(INVITE_PREFIX + token, json, 7, TimeUnit.DAYS);
        } catch (Exception e) {
            throw ShieldException.badRequest("Failed to create invite token");
        }

        // Fire-and-forget email via notification service
        notificationClient.sendCoParentInviteEmail(req.getEmail(), req.getFamilyName(), token);

        log.info("Co-parent invite dispatched to {} by userId={} tenantId={}",
                req.getEmail(), inviterUserId, req.getTenantId());
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

        // PIN is optional — only validate format if the caller provided one
        if (pin != null && !pin.isBlank() && pin.length() < 4) {
            throw ShieldException.badRequest("PIN must be at least 4 digits");
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

    // ── Session management ───────────────────────────────────────────────────

    /**
     * Revokes ALL active sessions for the user — sets a Redis blacklist timestamp
     * so the gateway rejects any access token issued before this moment.
     */
    @Transactional
    public void logoutAll(UUID userId) {
        // 1. Set a blacklist timestamp — gateway rejects any token issued before this
        redis.opsForValue().set(
                BLACKLIST_PREFIX + userId,
                String.valueOf(Instant.now().getEpochSecond()),
                Duration.ofDays(31));
        // 2. Delete the active refresh token index
        redis.delete(REFRESH_PREFIX + "user:" + userId);
        // 3. Revoke all active DB sessions
        sessionRepository.revokeAllForUser(userId, Instant.now());
        log.info("Logged out all sessions for userId={}", userId);
        auditClient.log("USER_LOGOUT_ALL", "User", userId.toString(),
                userId, null, null, Map.of());
    }

    /** Returns all non-revoked sessions for the given user. */
    public List<SessionResponse> getSessions(UUID userId) {
        return sessionRepository.findByUserIdAndRevokedFalse(userId).stream()
                .map(this::toSessionResponse)
                .toList();
    }

    /** Revokes a specific session by id, also blacklists tokens issued before now. */
    @Transactional
    public void revokeSession(UUID sessionId, UUID userId) {
        Session session = sessionRepository.findByIdAndUserIdAndRevokedFalse(sessionId, userId)
                .orElseThrow(() -> ShieldException.notFound("Session", sessionId));
        session.setRevoked(true);
        session.setRevokedAt(Instant.now());
        sessionRepository.save(session);
        // Blacklist tokens — if this is the only device the effect is same as logout
        redis.opsForValue().set(
                BLACKLIST_PREFIX + userId,
                String.valueOf(Instant.now().getEpochSecond()),
                Duration.ofDays(31));
        log.info("Revoked sessionId={} for userId={}", sessionId, userId);
        auditClient.log("SESSION_REVOKED", "Session", sessionId.toString(),
                userId, null, null, Map.of("sessionId", sessionId.toString()));
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

    private SessionResponse toSessionResponse(Session s) {
        return SessionResponse.builder()
                .id(s.getId())
                .deviceName(s.getDeviceName())
                .deviceType(s.getDeviceType())
                .ipAddress(s.getIpAddress())
                .lastActive(s.getLastActive())
                .createdAt(s.getCreatedAt())
                .build();
    }

    /**
     * Persists a session row for the login event.
     * Computes a SHA-256 fingerprint from userAgent + ipAddress.
     * If the fingerprint is new for this user, sends a push notification.
     */
    @Transactional
    void createSessionWithFingerprint(User user, String userAgent, String ipAddress) {
        String fingerprint = computeFingerprint(userAgent, ipAddress);
        boolean isNewDevice = !sessionRepository.existsByUserIdAndFingerprintHash(user.getId(), fingerprint);

        String deviceType = detectDeviceType(userAgent);

        Session session = new Session();
        session.setUserId(user.getId());
        session.setDeviceName(buildDeviceName(userAgent));
        session.setDeviceType(deviceType);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setFingerprintHash(fingerprint);
        sessionRepository.save(session);

        if (isNewDevice) {
            log.info("New device detected for userId={} fingerprint={}", user.getId(), fingerprint);
            notificationClient.sendNewDeviceNotification(user.getId(), user.getEmail(),
                    user.getName(), ipAddress, deviceType);
        }
    }

    private static String computeFingerprint(String userAgent, String ipAddress) {
        try {
            String raw = (userAgent != null ? userAgent : "") + ":" + (ipAddress != null ? ipAddress : "");
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private static String detectDeviceType(String userAgent) {
        if (userAgent == null) return "DESKTOP";
        String ua = userAgent.toLowerCase();
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) return "MOBILE";
        if (ua.contains("tablet") || ua.contains("ipad")) return "TABLET";
        return "DESKTOP";
    }

    private static String buildDeviceName(String userAgent) {
        if (userAgent == null) return "Unknown Device";
        if (userAgent.toLowerCase().contains("android")) return "Android Device";
        if (userAgent.toLowerCase().contains("iphone"))  return "iPhone";
        if (userAgent.toLowerCase().contains("ipad"))    return "iPad";
        if (userAgent.toLowerCase().contains("windows")) return "Windows Device";
        if (userAgent.toLowerCase().contains("mac"))     return "Mac Device";
        if (userAgent.toLowerCase().contains("linux"))   return "Linux Device";
        return "Unknown Device";
    }
}
