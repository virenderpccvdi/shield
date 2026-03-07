package com.rstglobal.shield.notification.config;

import com.rstglobal.shield.notification.entity.NotificationChannel;
import com.rstglobal.shield.notification.repository.NotificationChannelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the platform default SMTP channel on startup if it does not exist.
 * Reads credentials from environment variables so the admin can configure
 * them without touching application config files.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultChannelSeeder implements ApplicationRunner {

    private final NotificationChannelRepository channelRepo;

    @Value("${smtp.host:smtp.zoho.com}")
    private String smtpHost;

    @Value("${smtp.port:587}")
    private int smtpPort;

    @Value("${smtp.user:noreply@rstglobal.in}")
    private String smtpUser;

    @Value("${smtp.pass:}")
    private String smtpPass;

    @Value("${smtp.from:noreply@rstglobal.in}")
    private String smtpFrom;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // Check if platform default SMTP channel already exists (tenantId = null)
        boolean exists = channelRepo.findByTenantIdIsNullAndChannelType("SMTP").isPresent();
        if (exists) {
            log.debug("Platform default SMTP channel already exists — skipping seed.");
            return;
        }

        boolean hasPassword = smtpPass != null && !smtpPass.isBlank()
                && !"your-smtp-password".equals(smtpPass.trim());

        // Extract plain from-email if the env var includes a display name like "Shield <noreply@...>"
        String fromEmail = extractEmail(smtpFrom);
        String fromName = extractName(smtpFrom);

        NotificationChannel channel = NotificationChannel.builder()
                .tenantId(null)              // platform-wide default
                .channelType("SMTP")
                .enabled(hasPassword)
                .smtpHost(smtpHost)
                .smtpPort(smtpPort)
                .smtpUsername(smtpUser)
                .smtpPassword(hasPassword ? smtpPass : "")
                .smtpFromEmail(fromEmail)
                .smtpFromName(fromName.isBlank() ? "Shield" : fromName)
                .smtpTls(true)
                .build();

        channelRepo.save(channel);

        if (hasPassword) {
            log.info("Seeded default SMTP channel — host={}, user={}, enabled=true", smtpHost, smtpUser);
        } else {
            log.warn("Seeded default SMTP channel (disabled) — SMTP_PASS not set or is placeholder. " +
                     "Go to Notification Channels settings in the admin dashboard to configure your SMTP credentials.");
        }
    }

    /** Extracts the email address from formats like 'Shield <noreply@rstglobal.in>' or 'noreply@rstglobal.in'. */
    private String extractEmail(String from) {
        if (from == null) return "";
        int start = from.indexOf('<');
        int end = from.indexOf('>');
        if (start >= 0 && end > start) {
            return from.substring(start + 1, end).trim();
        }
        return from.trim();
    }

    /** Extracts the display name from 'Shield <noreply@rstglobal.in>' → 'Shield'. Returns "" if not present. */
    private String extractName(String from) {
        if (from == null) return "";
        int start = from.indexOf('<');
        if (start > 0) {
            return from.substring(0, start).trim();
        }
        return "";
    }
}
