package com.rstglobal.shield.auth.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Async HTTP client that calls shield-notification internal endpoints.
 * All calls are fire-and-forget — failures are logged but never rethrown.
 */
@Slf4j
@Component
public class NotificationClient {

    private static final String SUPPORT_EMAIL = "support@pccvdi.com";
    private static final String APP_DOMAIN    = "https://shield.rstglobal.in";

    private final RestClient restClient;
    private final String     notificationBaseUrl;

    public NotificationClient(
            @Value("${shield.notification.url:http://localhost:8286}") String notificationBaseUrl) {
        this.restClient          = RestClient.builder().build();
        this.notificationBaseUrl = notificationBaseUrl;
    }

    /**
     * Sends a welcome email to a newly-admin-created user that includes a
     * password-setup link valid for 24 hours.
     * Does NOT include a plaintext password — the user must set their password via the link.
     *
     * @param userId  the new user's UUID (used to build the setup token)
     * @param email   recipient address
     * @param name    display name
     * @param role    user role string (e.g. "ISP_ADMIN", "CUSTOMER")
     * @param otp     one-time password already stored in Redis
     */
    @Async
    public void sendWelcomeEmail(UUID userId, String email, String name, String role, String otp) {
        try {
            String rawToken  = userId + ":" + otp;
            String setupToken = Base64.getEncoder().encodeToString(rawToken.getBytes());
            String setupUrl  = APP_DOMAIN + "/app/reset-password?token=" + setupToken;

            Map<String, Object> variables = new HashMap<>();
            variables.put("name",         name != null ? name : email);
            variables.put("email",        email);
            variables.put("role",         role);
            variables.put("setupUrl",     setupUrl);
            variables.put("supportEmail", SUPPORT_EMAIL);

            Map<String, Object> payload = new HashMap<>();
            payload.put("to",           email);
            payload.put("subject",      "Welcome to Shield — Set Up Your Account");
            payload.put("templateName", "welcome-user");
            payload.put("variables",    variables);

            restClient.post()
                    .uri(notificationBaseUrl + "/internal/notifications/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Welcome email dispatched for userId={} email={}", userId, email);
        } catch (Exception e) {
            log.warn("Failed to send welcome email to {}: {}", email, e.getMessage());
        }
    }

    /**
     * Sends a self-service password-reset OTP email (from "Forgot Password" flow).
     * The OTP is embedded in a signed Base64 token: userId:otp.
     */
    @Async
    public void sendPasswordResetOtpEmail(UUID userId, String email, String name, String otp) {
        try {
            String rawToken   = userId + ":" + otp;
            String resetToken = Base64.getEncoder().encodeToString(rawToken.getBytes());
            String resetUrl   = APP_DOMAIN + "/app/reset-password?token=" + resetToken;

            Map<String, Object> variables = new HashMap<>();
            variables.put("name",         name != null ? name : email);
            variables.put("email",        email);
            variables.put("otp",          otp);
            variables.put("resetUrl",     resetUrl);
            variables.put("supportEmail", SUPPORT_EMAIL);

            Map<String, Object> payload = new HashMap<>();
            payload.put("to",           email);
            payload.put("subject",      "Shield — Your Password Reset Code");
            payload.put("templateName", "password-reset-otp");
            payload.put("variables",    variables);

            restClient.post()
                    .uri(notificationBaseUrl + "/internal/notifications/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Password-reset OTP email dispatched for userId={}", userId);
        } catch (Exception e) {
            log.warn("Failed to send password-reset OTP email to {}: {}", email, e.getMessage());
        }
    }

    /**
     * Sends an email address verification OTP (self-service registration flow).
     * The OTP is also embedded in a signed Base64 token: userId:otp.
     */
    @Async
    public void sendEmailVerificationOtp(UUID userId, String email, String name, String otp) {
        try {
            String rawToken   = userId + ":" + otp;
            String verifToken = Base64.getEncoder().encodeToString(rawToken.getBytes());
            String verifUrl   = APP_DOMAIN + "/app/verify-email?token=" + verifToken;

            Map<String, Object> variables = new HashMap<>();
            variables.put("name",         name != null ? name : email);
            variables.put("email",        email);
            variables.put("otp",          otp);
            variables.put("verifUrl",     verifUrl);
            variables.put("supportEmail", SUPPORT_EMAIL);

            Map<String, Object> payload = new HashMap<>();
            payload.put("to",           email);
            payload.put("subject",      "Shield — Verify Your Email Address");
            payload.put("templateName", "email-verification");
            payload.put("variables",    variables);

            restClient.post()
                    .uri(notificationBaseUrl + "/internal/notifications/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Email verification OTP dispatched for userId={}", userId);
        } catch (Exception e) {
            log.warn("Failed to send email verification OTP to {}: {}", email, e.getMessage());
        }
    }

    /**
     * Sends a 6-digit MFA email OTP to a user who has triggered the email-based
     * second factor during login.
     */
    @Async
    public void sendEmailOtp(String email, String name, String otp) {
        try {
            Map<String, Object> variables = new HashMap<>();
            variables.put("name",         name != null ? name : email);
            variables.put("otp",          otp);
            variables.put("supportEmail", SUPPORT_EMAIL);

            Map<String, Object> payload = new HashMap<>();
            payload.put("to",           email);
            payload.put("subject",      "Shield — Your Login Verification Code");
            payload.put("templateName", "email/mfa-otp");
            payload.put("variables",    variables);

            restClient.post()
                    .uri(notificationBaseUrl + "/internal/notifications/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("MFA email OTP dispatched to {}", email);
        } catch (Exception e) {
            log.warn("Failed to send MFA email OTP to {}: {}", email, e.getMessage());
        }
    }

    /** Sends a password-reset email from an admin reset action, containing the new plaintext password. */
    @Async
    public void sendAdminPasswordResetEmail(String email, String name, String newPassword) {
        try {
            Map<String, Object> variables = new HashMap<>();
            variables.put("name",         name != null ? name : email);
            variables.put("email",        email);
            variables.put("newPassword",  newPassword);
            variables.put("loginUrl",     APP_DOMAIN + "/app/login");
            variables.put("supportEmail", SUPPORT_EMAIL);

            Map<String, Object> payload = new HashMap<>();
            payload.put("to",           email);
            payload.put("subject",      "Shield — Your Password Has Been Reset");
            payload.put("templateName", "password-reset-admin");
            payload.put("variables",    variables);

            restClient.post()
                    .uri(notificationBaseUrl + "/internal/notifications/email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Admin password-reset email dispatched to {}", email);
        } catch (Exception e) {
            log.warn("Failed to send admin password-reset email to {}: {}", email, e.getMessage());
        }
    }
}
