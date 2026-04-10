package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.entity.NotificationChannel;
import com.rstglobal.shield.notification.repository.NotificationChannelRepository;
import com.rstglobal.shield.notification.service.WeeklyDigestService.WeeklyDigestData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;
import java.util.Properties;
import java.util.UUID;

/**
 * Sends emails using SMTP configuration stored in the DB (notification.notification_channels).
 * GLOBAL_ADMIN configures SMTP via the admin UI — no hardcoded env-var fallback.
 *
 * Lookup order:
 *   1. Tenant-specific channel (tenantId match, enabled=true)
 *   2. Platform default channel (tenantId IS NULL, enabled=true)
 *   3. Return false / skip if neither exists or both disabled.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final NotificationChannelRepository channelRepo;
    private final TemplateEngine templateEngine;

    // ── Public send methods ────────────────────────────────────────────────

    /** Send an HTML email via Thymeleaf template. */
    public boolean sendEmail(UUID tenantId, String toEmail, String subject,
                              String templateName, Map<String, Object> variables) {
        NotificationChannel channel = resolveChannel(tenantId);
        if (channel == null) {
            log.warn("SMTP not configured (tenantId={}) — skipping email to {}", tenantId, toEmail);
            return false;
        }
        try {
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), fromName(channel));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            Context ctx = new Context();
            ctx.setVariables(variables);
            helper.setText(templateEngine.process(templateName, ctx), true);
            sender.send(message);
            log.info("Email sent: to={} subject={}", toEmail, subject);
            return true;
        } catch (Exception e) {
            log.warn("Email send failed to={}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    /** Send a plain-text email. */
    public boolean sendPlainEmail(UUID tenantId, String toEmail, String subject, String body) {
        NotificationChannel channel = resolveChannel(tenantId);
        if (channel == null) {
            log.warn("SMTP not configured (tenantId={}) — skipping plain email to {}", tenantId, toEmail);
            return false;
        }
        try {
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), fromName(channel));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(body, false);
            sender.send(message);
            log.info("Plain email sent: to={} subject={}", toEmail, subject);
            return true;
        } catch (Exception e) {
            log.warn("Plain email send failed: {}", e.getMessage());
            return false;
        }
    }

    /** Send emergency alert using platform-default SMTP channel. */
    public boolean sendEmergencyAlert(String toEmail, String recipientName, String subject, String body) {
        NotificationChannel channel = resolveChannel(null);
        if (channel == null) {
            log.warn("SMTP not configured (platform) — skipping emergency alert to {}", toEmail);
            return false;
        }
        try {
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), fromName(channel));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            String greeting = recipientName != null && !recipientName.isBlank()
                    ? "Dear " + recipientName + ",\n\n" : "";
            helper.setText(greeting + body + "\n\n-- Shield Family Safety", false);
            sender.send(message);
            log.info("Emergency alert email sent to {}", toEmail);
            return true;
        } catch (Exception e) {
            log.warn("Emergency alert email failed to {}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    /** Send weekly digest email using platform-default SMTP channel. */
    public boolean sendWeeklyDigest(String toEmail, String parentName, WeeklyDigestData data) {
        NotificationChannel channel = resolveChannel(null);
        if (channel == null) {
            log.debug("SMTP not configured (platform) — skipping weekly digest to {}", toEmail);
            return false;
        }
        try {
            String html = buildDigestHtml(parentName, data);
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), fromName(channel));
            helper.setTo(toEmail);
            helper.setSubject("Shield Weekly Report — " + data.weekStart() + " – " + data.weekEnd());
            helper.setText(html, true);
            sender.send(message);
            log.info("Weekly digest sent: to={} child={}", toEmail, data.childName());
            return true;
        } catch (Exception e) {
            log.warn("Weekly digest send failed to={}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    /** Send a monthly report card email using platform-default SMTP channel. */
    public boolean sendReportCard(String toEmail, String parentName, String subject, String html) {
        NotificationChannel channel = resolveChannel(null);
        if (channel == null) {
            log.debug("SMTP not configured (platform) — skipping report card to {}", toEmail);
            return false;
        }
        try {
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), fromName(channel));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(html, true);
            sender.send(message);
            log.info("Report card email sent: to={} subject={}", toEmail, subject);
            return true;
        } catch (Exception e) {
            log.warn("Report card email send failed to={}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────

    /**
     * Resolve the effective SMTP channel: tenant-specific first, then platform default.
     * Returns null if no enabled channel exists.
     */
    private NotificationChannel resolveChannel(UUID tenantId) {
        // Try tenant-specific channel first (only when tenantId is not null)
        if (tenantId != null) {
            NotificationChannel tenant = channelRepo
                    .findByTenantIdAndChannelType(tenantId, "SMTP").orElse(null);
            if (tenant != null && Boolean.TRUE.equals(tenant.getEnabled())) {
                return tenant;
            }
        }
        // Fall back to platform default (tenant_id IS NULL)
        NotificationChannel platform = channelRepo
                .findByTenantIdIsNullAndChannelType("SMTP").orElse(null);
        if (platform != null && Boolean.TRUE.equals(platform.getEnabled())) {
            return platform;
        }
        return null;
    }

    private String fromName(NotificationChannel ch) {
        String name = ch.getSmtpFromName();
        return (name != null && !name.isBlank()) ? name : ch.getSmtpFromEmail();
    }

    private JavaMailSenderImpl buildSender(NotificationChannel ch) {
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(ch.getSmtpHost());
        int port = ch.getSmtpPort() != null ? ch.getSmtpPort() : 587;
        s.setPort(port);
        s.setUsername(ch.getSmtpUsername());
        s.setPassword(ch.getSmtpPassword());
        Properties p = s.getJavaMailProperties();
        p.put("mail.transport.protocol", "smtp");
        p.put("mail.smtp.auth", "true");
        if (port == 465) {
            p.put("mail.smtp.ssl.enable", "true");
            p.put("mail.smtp.ssl.trust", ch.getSmtpHost());
            p.put("mail.smtp.starttls.enable", "false");
        } else {
            // 587 or any other port → STARTTLS
            p.put("mail.smtp.starttls.enable", "true");
            p.put("mail.smtp.starttls.required", "true");
        }
        p.put("mail.smtp.timeout", "15000");
        p.put("mail.smtp.connectiontimeout", "15000");
        p.put("mail.smtp.writetimeout", "15000");
        return s;
    }

    private String buildDigestHtml(String parentName, WeeklyDigestData data) {
        String topBlockedHtml = data.topBlockedDomains().isEmpty() ? "" :
                "<h3 style='color:#1565C0;margin:20px 0 8px'>Top Blocked Domains</h3><ul style='margin:0;padding-left:20px'>" +
                data.topBlockedDomains().stream()
                        .map(d -> "<li style='font-size:14px;color:#444;padding:2px 0'>" + d + "</li>")
                        .collect(java.util.stream.Collectors.joining()) +
                "</ul>";

        return "<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f0f2f5;padding:20px'>" +
                "<div style='background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.07)'>" +
                "<div style='background:linear-gradient(135deg,#1565C0 0%,#42A5F5 60%,#26C6DA 100%);padding:28px 32px;color:#fff'>" +
                "<div style='font-size:22px;font-weight:800'>Shield <span style='opacity:.7;font-weight:400;font-size:13px;margin-left:6px'>Family Protection</span></div>" +
                "<h2 style='margin:16px 0 4px;font-size:22px'>&#128202; Weekly Shield Report</h2>" +
                "<div style='opacity:.85;font-size:13px'>" + data.weekStart() + " &ndash; " + data.weekEnd() + "</div>" +
                "</div>" +
                "<div style='padding:28px 32px'>" +
                "<p style='font-size:15px;color:#333;margin:0 0 16px'>Hi <b>" + parentName + "</b>,</p>" +
                "<p style='font-size:14px;color:#555;margin:0 0 20px'>Here&rsquo;s your weekly summary for <b>" + data.childName() + "</b>.</p>" +
                "<table style='width:100%;border-collapse:collapse'>" +
                "<tr style='background:#f8fafc'><td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Total DNS Queries</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#1565C0;font-weight:700'>" + data.totalQueriesThisWeek() + "</td></tr>" +
                "<tr><td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Blocked</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#e53935;font-weight:700'>" + data.blockedThisWeek() + "</td></tr>" +
                "<tr style='background:#f8fafc'><td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Allowed</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#43a047;font-weight:700'>" + data.allowedThisWeek() + "</td></tr>" +
                "<tr><td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>SOS Alerts</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#" + (data.sosAlertsThisWeek() > 0 ? "e53935" : "333") + ";font-weight:700'>" + data.sosAlertsThisWeek() + "</td></tr>" +
                "<tr style='background:#f8fafc'><td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Geofence Breaches</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#" + (data.geofenceBreachesThisWeek() > 0 ? "f57c00" : "333") + ";font-weight:700'>" + data.geofenceBreachesThisWeek() + "</td></tr>" +
                "</table>" + topBlockedHtml +
                "<div style='text-align:center;margin:28px 0 8px'>" +
                "<a href='https://shield.rstglobal.in/app/analytics' style='display:inline-block;background:linear-gradient(135deg,#1565C0,#42A5F5);color:#fff;text-decoration:none;padding:13px 34px;border-radius:8px;font-weight:700;font-size:14px'>View Full Report</a>" +
                "</div></div>" +
                "<div style='background:#f8f9fa;padding:16px 32px;text-align:center;color:#aaa;font-size:12px;line-height:1.6'>" +
                "You are receiving this because you are a Shield subscriber.<br/>" +
                "To change preferences, open Shield &rarr; Settings &rarr; Notifications.<br/>" +
                "&copy; 2026 Shield by RST Global." +
                "</div></div></body></html>";
    }
}
