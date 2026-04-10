package com.rstglobal.shield.auth.service;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import com.warrenstrange.googleauth.GoogleAuthenticatorQRGenerator;
import com.rstglobal.shield.auth.client.NotificationClient;
import com.rstglobal.shield.auth.dto.response.MfaSetupResponse;
import com.rstglobal.shield.auth.entity.User;
import com.rstglobal.shield.auth.repository.UserRepository;
import com.rstglobal.shield.common.exception.ShieldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MfaService {

    private static final String MFA_TOKEN_PREFIX   = "shield:auth:mfa:";
    private static final String EMAIL_OTP_PREFIX   = "shield:auth:email_otp:";
    private static final int    MFA_TOKEN_TTL_MINUTES = 5;
    private static final int    BACKUP_CODE_COUNT  = 8;
    private static final String ISSUER = "Shield";

    private final UserRepository      userRepository;
    private final StringRedisTemplate redis;
    private final NotificationClient  notificationClient;
    private final PasswordEncoder     passwordEncoder;
    private final GoogleAuthenticator googleAuthenticator = new GoogleAuthenticator();

    /**
     * Generate a TOTP secret and backup codes for the user.
     * The secret is NOT yet stored — it must be verified first via verifyAndEnable().
     */
    public MfaSetupResponse setup(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        if (user.isMfaEnabled()) {
            throw ShieldException.badRequest("MFA is already enabled. Disable it first.");
        }

        GoogleAuthenticatorKey key = googleAuthenticator.createCredentials();
        String secret = key.getKey();

        // Store the pending secret in Redis (not in DB until verified)
        redis.opsForValue().set(
                MFA_TOKEN_PREFIX + "setup:" + userId,
                secret,
                10, TimeUnit.MINUTES);

        // Generate backup codes
        List<String> backupCodes = generateBackupCodes();
        redis.opsForValue().set(
                MFA_TOKEN_PREFIX + "backup:" + userId,
                String.join(",", backupCodes),
                10, TimeUnit.MINUTES);

        // Generate otpauth:// URI for QR code
        String qrCodeUrl = GoogleAuthenticatorQRGenerator.getOtpAuthTotpURL(
                ISSUER, user.getEmail(), key);

        log.info("MFA setup initiated for user {}", userId);

        return MfaSetupResponse.builder()
                .secret(secret)
                .qrCodeUrl(qrCodeUrl)
                .backupCodes(backupCodes)
                .build();
    }

    /**
     * Verify the TOTP code and enable MFA on the account.
     */
    @Transactional
    public void verifyAndEnable(UUID userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        String pendingSecret = redis.opsForValue().get(MFA_TOKEN_PREFIX + "setup:" + userId);
        if (pendingSecret == null) {
            throw ShieldException.badRequest("No MFA setup in progress. Call /mfa/setup first.");
        }

        if (!googleAuthenticator.authorize(pendingSecret, parseTotpCode(code))) {
            throw ShieldException.badRequest("Invalid TOTP code. Please try again.");
        }

        // Retrieve backup codes
        String backupCodesStr = redis.opsForValue().get(MFA_TOKEN_PREFIX + "backup:" + userId);

        user.setMfaEnabled(true);
        user.setMfaSecret(pendingSecret);
        user.setMfaBackupCodes(backupCodesStr);
        userRepository.save(user);

        // Clean up Redis
        redis.delete(MFA_TOKEN_PREFIX + "setup:" + userId);
        redis.delete(MFA_TOKEN_PREFIX + "backup:" + userId);

        log.info("MFA enabled for user {}", userId);
    }

    /**
     * Disable MFA — requires a valid TOTP code or backup code AND the user's current password.
     * Both checks must pass; this prevents an attacker with a stolen session from disabling MFA.
     */
    @Transactional
    public void disable(UUID userId, String code, String currentPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        if (!user.isMfaEnabled()) {
            throw ShieldException.badRequest("MFA is not enabled");
        }

        // Re-authentication: verify current password before allowing MFA to be disabled
        if (currentPassword == null || currentPassword.isBlank()
                || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw ShieldException.badRequest("Incorrect password");
        }

        if (!validateCode(user, code)) {
            throw ShieldException.badRequest("Invalid TOTP or backup code");
        }

        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaBackupCodes(null);
        userRepository.save(user);

        log.info("MFA disabled for user {}", userId);
    }

    /**
     * Store a temporary MFA token in Redis when a user with MFA logs in.
     * Returns the temporary token that must be used with /mfa/validate.
     */
    public String createMfaToken(UUID userId) {
        String mfaToken = UUID.randomUUID().toString();
        redis.opsForValue().set(
                MFA_TOKEN_PREFIX + "login:" + mfaToken,
                userId.toString(),
                MFA_TOKEN_TTL_MINUTES, TimeUnit.MINUTES);
        return mfaToken;
    }

    /**
     * Validate a TOTP code (or email OTP) against the MFA token from login.
     * Returns the userId if valid.
     */
    public UUID validateMfaLogin(String mfaToken, String code) {
        String key = MFA_TOKEN_PREFIX + "login:" + mfaToken;
        String userIdStr = redis.opsForValue().get(key);
        if (userIdStr == null) {
            throw ShieldException.badRequest("MFA token expired or invalid. Please login again.");
        }

        UUID userId = UUID.fromString(userIdStr);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        // First try TOTP / backup code
        if (validateCode(user, code)) {
            redis.delete(key);
            return userId;
        }

        // Then try email OTP as alternative
        if (validateEmailOtp(mfaToken, code)) {
            redis.delete(key);
            return userId;
        }

        throw ShieldException.badRequest("Invalid MFA code");
    }

    /**
     * Send a 6-digit OTP to the user's email.
     * Called after login when mfaRequired=true.
     */
    public void sendEmailOtp(String mfaToken) {
        String key = MFA_TOKEN_PREFIX + "login:" + mfaToken;
        String userIdStr = redis.opsForValue().get(key);
        if (userIdStr == null) throw ShieldException.badRequest("MFA token expired or invalid. Please login again.");
        UUID userId = UUID.fromString(userIdStr);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ShieldException.notFound("User", userId));

        String otp = String.format("%06d", new SecureRandom().nextInt(1000000));
        redis.opsForValue().set(EMAIL_OTP_PREFIX + mfaToken, otp, MFA_TOKEN_TTL_MINUTES, TimeUnit.MINUTES);

        notificationClient.sendEmailOtp(user.getEmail(), user.getName(), otp);
        log.info("Email OTP sent for mfaToken={} userId={}", mfaToken, userId);
    }

    /**
     * Validate email OTP (used in validateMfaLogin as alternative to TOTP).
     */
    public boolean validateEmailOtp(String mfaToken, String code) {
        String stored = redis.opsForValue().get(EMAIL_OTP_PREFIX + mfaToken);
        if (stored != null && stored.equals(code)) {
            redis.delete(EMAIL_OTP_PREFIX + mfaToken);
            return true;
        }
        return false;
    }

    /**
     * Check if the user has MFA enabled.
     */
    public boolean isMfaEnabled(UUID userId) {
        return userRepository.findById(userId)
                .map(User::isMfaEnabled)
                .orElse(false);
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /** Parse TOTP code safely — preserves leading zeros by treating as base-10 int directly.
     *  "012345" → 12345 which is the same integer the TOTP library expects. */
    private static int parseTotpCode(String code) {
        if (code == null || !code.matches("\\d{6}")) throw new NumberFormatException("Not a 6-digit TOTP code");
        return Integer.parseInt(code); // safe: 6-digit codes never overflow int
    }

    private boolean validateCode(User user, String code) {
        // Try TOTP code first (6-digit numeric)
        try {
            int intCode = parseTotpCode(code);
            if (googleAuthenticator.authorize(user.getMfaSecret(), intCode)) {
                return true;
            }
        } catch (NumberFormatException ignored) {
            // Not a numeric code — might be a backup code
        }

        // Try backup codes
        if (user.getMfaBackupCodes() != null && !user.getMfaBackupCodes().isBlank()) {
            List<String> backupCodes = new ArrayList<>(List.of(user.getMfaBackupCodes().split(",")));
            if (backupCodes.remove(code)) {
                // Consume the backup code
                user.setMfaBackupCodes(backupCodes.isEmpty() ? null : String.join(",", backupCodes));
                userRepository.save(user);
                log.info("Backup code used for user {}, {} remaining", user.getId(), backupCodes.size());
                return true;
            }
        }

        return false;
    }

    private List<String> generateBackupCodes() {
        SecureRandom random = new SecureRandom();
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < BACKUP_CODE_COUNT; i++) {
            // Generate 8-char alphanumeric codes like "A3K9-B2M7"
            String part1 = String.format("%04d", random.nextInt(10000));
            String part2 = String.format("%04d", random.nextInt(10000));
            codes.add(part1 + "-" + part2);
        }
        return codes;
    }
}
