package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.entity.NotificationChannel;
import com.rstglobal.shield.notification.repository.NotificationChannelRepository;
import com.rstglobal.shield.notification.service.WeeklyDigestService.WeeklyDigestData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final NotificationChannelRepository channelRepo;
    private final TemplateEngine templateEngine;

    @Value("${SMTP_HOST:smtp.zoho.com}")       private String envSmtpHost;
    @Value("${SMTP_PORT:465}")                 private int    envSmtpPort;
    @Value("${SMTP_USER:}")                    private String envSmtpUser;
    @Value("${SMTP_PASS:}")                    private String envSmtpPass;
    @Value("${SMTP_FROM:Shield <noreply@shield.local>}") private String envSmtpFrom;

    /**
     * Send an HTML email using the tenant's SMTP config (or platform default).
     * Silently logs and returns false if SMTP is not configured or fails.
     */
    public boolean sendEmail(UUID tenantId, String toEmail, String subject,
                              String templateName, Map<String, Object> variables) {
        NotificationChannel channel = channelRepo.findEffective(tenantId, "SMTP").orElse(null);
        JavaMailSenderImpl sender;
        String fromEmail;
        String fromName;
        if (channel != null && Boolean.TRUE.equals(channel.getEnabled())) {
            sender    = buildSender(channel);
            fromEmail = channel.getSmtpFromEmail();
            fromName  = channel.getSmtpFromName();
        } else {
            if (envSmtpUser == null || envSmtpUser.isBlank()) {
                log.debug("SMTP not configured for tenantId={} — skipping email to {}", tenantId, toEmail);
                return false;
            }
            sender    = buildEnvSender();
            String[] parsed = parseFromAddress(envSmtpFrom);
            fromName  = parsed[0];
            fromEmail = parsed[1];
        }
        try {
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, fromName);
            helper.setTo(toEmail);
            helper.setSubject(subject);

            Context ctx = new Context();
            ctx.setVariables(variables);
            String html = templateEngine.process(templateName, ctx);
            helper.setText(html, true);

            sender.send(message);
            log.info("Email sent: to={} subject={}", toEmail, subject);
            return true;
        } catch (Exception e) {
            log.warn("Email send failed to={}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    /** Send plain-text email (no template). */
    public boolean sendPlainEmail(UUID tenantId, String toEmail, String subject, String body) {
        NotificationChannel channel = channelRepo.findEffective(tenantId, "SMTP").orElse(null);
        JavaMailSenderImpl sender;
        String fromEmail;
        String fromName;
        if (channel != null && Boolean.TRUE.equals(channel.getEnabled())) {
            sender    = buildSender(channel);
            fromEmail = channel.getSmtpFromEmail();
            fromName  = channel.getSmtpFromName();
        } else {
            if (envSmtpUser == null || envSmtpUser.isBlank()) {
                log.debug("SMTP not configured for tenantId={} — skipping email", tenantId);
                return false;
            }
            sender    = buildEnvSender();
            String[] parsed = parseFromAddress(envSmtpFrom);
            fromName  = parsed[0];
            fromEmail = parsed[1];
        }
        try {
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromEmail, fromName);
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

    /**
     * Send a plain-text emergency alert email to an external recipient (e.g. emergency contact).
     * Uses the platform-default SMTP channel (tenantId = null).
     */
    public boolean sendEmergencyAlert(String toEmail, String recipientName, String subject, String body) {
        NotificationChannel channel = channelRepo.findEffective(null, "SMTP").orElse(null);
        JavaMailSenderImpl sender;
        String fromEmail;
        String fromName;
        if (channel != null && Boolean.TRUE.equals(channel.getEnabled())) {
            sender    = buildSender(channel);
            fromEmail = channel.getSmtpFromEmail();
            fromName  = channel.getSmtpFromName();
        } else {
            if (envSmtpUser == null || envSmtpUser.isBlank()) {
                log.debug("SMTP not configured for platform — skipping emergency alert to {}", toEmail);
                return false;
            }
            sender    = buildEnvSender();
            String[] parsed = parseFromAddress(envSmtpFrom);
            fromName  = parsed[0];
            fromEmail = parsed[1];
        }
        try {
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromEmail, fromName);
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

    /**
     * Send a weekly digest email to a parent using an inline-built HTML body.
     * Falls back to the platform-default SMTP channel (tenantId = null) so that
     * the digest can always be delivered even when a tenant channel is not configured.
     *
     * @param toEmail    recipient address
     * @param parentName first name / display name for the greeting
     * @param data       per-child stats for the week
     * @return true if the email was dispatched successfully
     */
    public boolean sendWeeklyDigest(String toEmail, String parentName, WeeklyDigestData data) {
        // Try tenant channel first; fall back to platform default (null tenantId)
        NotificationChannel channel = channelRepo.findEffective(null, "SMTP").orElse(null);
        JavaMailSenderImpl sender;
        String fromEmail;
        String fromName;
        if (channel != null && Boolean.TRUE.equals(channel.getEnabled())) {
            sender    = buildSender(channel);
            fromEmail = channel.getSmtpFromEmail();
            fromName  = channel.getSmtpFromName();
        } else {
            if (envSmtpUser == null || envSmtpUser.isBlank()) {
                log.debug("SMTP not configured (platform) — skipping weekly digest to {}", toEmail);
                return false;
            }
            sender    = buildEnvSender();
            String[] parsed = parseFromAddress(envSmtpFrom);
            fromName  = parsed[0];
            fromEmail = parsed[1];
        }
        try {
            String html = buildDigestHtml(parentName, data);

            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, fromName);
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

    /**
     * Send a monthly report card email to a parent using a pre-built HTML body.
     * Uses the platform-default SMTP channel (tenantId = null).
     *
     * @param toEmail    recipient address
     * @param parentName display name used in the greeting
     * @param subject    email subject line
     * @param html       fully-rendered HTML body
     * @return true if the email was dispatched successfully
     */
    public boolean sendReportCard(String toEmail, String parentName, String subject, String html) {
        NotificationChannel channel = channelRepo.findEffective(null, "SMTP").orElse(null);
        JavaMailSenderImpl sender;
        String fromEmail;
        String fromName;
        if (channel != null && Boolean.TRUE.equals(channel.getEnabled())) {
            sender    = buildSender(channel);
            fromEmail = channel.getSmtpFromEmail();
            fromName  = channel.getSmtpFromName();
        } else {
            if (envSmtpUser == null || envSmtpUser.isBlank()) {
                log.debug("SMTP not configured (platform) — skipping report card to {}", toEmail);
                return false;
            }
            sender    = buildEnvSender();
            String[] parsed = parseFromAddress(envSmtpFrom);
            fromName  = parsed[0];
            fromEmail = parsed[1];
        }
        try {
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, fromName);
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
                "<tr style='background:#f8fafc'>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Total DNS Queries</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#1565C0;font-weight:700'>" + data.totalQueriesThisWeek() + "</td>" +
                "</tr>" +
                "<tr>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Blocked</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#e53935;font-weight:700'>" + data.blockedThisWeek() + "</td>" +
                "</tr>" +
                "<tr style='background:#f8fafc'>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Allowed</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#43a047;font-weight:700'>" + data.allowedThisWeek() + "</td>" +
                "</tr>" +
                "<tr>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>SOS Alerts</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#" + (data.sosAlertsThisWeek() > 0 ? "e53935" : "333") + ";font-weight:700'>" + data.sosAlertsThisWeek() + "</td>" +
                "</tr>" +
                "<tr style='background:#f8fafc'>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#333'><b>Geofence Breaches</b></td>" +
                "<td style='padding:10px 12px;border:1px solid #e8ecf0;font-size:14px;color:#" + (data.geofenceBreachesThisWeek() > 0 ? "f57c00" : "333") + ";font-weight:700'>" + data.geofenceBreachesThisWeek() + "</td>" +
                "</tr>" +
                "</table>" +
                topBlockedHtml +
                "<div style='text-align:center;margin:28px 0 8px'>" +
                "<a href='https://shield.rstglobal.in/app/analytics' style='display:inline-block;background:linear-gradient(135deg,#1565C0,#42A5F5);color:#fff;text-decoration:none;padding:13px 34px;border-radius:8px;font-weight:700;font-size:14px'>View Full Report</a>" +
                "</div>" +
                "</div>" +
                "<div style='background:#f8f9fa;padding:16px 32px;text-align:center;color:#aaa;font-size:12px;line-height:1.6'>" +
                "You are receiving this because you are a Shield subscriber.<br/>" +
                "To change preferences, open Shield &rarr; Settings &rarr; Notifications.<br/>" +
                "&copy; 2026 Shield by RST Global." +
                "</div>" +
                "</div>" +
                "</body></html>";
    }

    /** Build a JavaMailSenderImpl from environment-variable SMTP config. */
    private JavaMailSenderImpl buildEnvSender() {
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(envSmtpHost);
        s.setPort(envSmtpPort);
        s.setUsername(envSmtpUser);
        s.setPassword(envSmtpPass);
        Properties p = s.getJavaMailProperties();
        p.put("mail.transport.protocol", "smtp");
        p.put("mail.smtp.auth", "true");
        if (envSmtpPort == 465) {
            p.put("mail.smtp.ssl.enable", "true");
            p.put("mail.smtp.ssl.trust", envSmtpHost);
            p.put("mail.smtp.starttls.enable", "false");
        } else {
            p.put("mail.smtp.starttls.enable", "true");
            p.put("mail.smtp.starttls.required", "true");
        }
        p.put("mail.smtp.timeout", "15000");
        p.put("mail.smtp.connectiontimeout", "15000");
        p.put("mail.smtp.writetimeout", "15000");
        return s;
    }

    /**
     * Parse "Display Name <email@domain>" or bare "email@domain".
     * Returns [name, email].
     */
    private static String[] parseFromAddress(String from) {
        if (from != null && from.contains("<") && from.contains(">")) {
            int lt = from.indexOf('<');
            int gt = from.indexOf('>');
            String name  = from.substring(0, lt).trim();
            String email = from.substring(lt + 1, gt).trim();
            return new String[]{ name.isBlank() ? email : name, email };
        }
        String addr = from != null ? from.trim() : "noreply@shield.local";
        return new String[]{ addr, addr };
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
            // Port 465: implicit SSL (Zoho, Gmail SMTPS)
            p.put("mail.smtp.ssl.enable", "true");
            p.put("mail.smtp.ssl.trust", ch.getSmtpHost());
            p.put("mail.smtp.starttls.enable", "false");
        } else if (Boolean.TRUE.equals(ch.getSmtpTls())) {
            // Port 587: STARTTLS
            p.put("mail.smtp.starttls.enable", "true");
            p.put("mail.smtp.starttls.required", "true");
        }
        p.put("mail.smtp.timeout", "15000");
        p.put("mail.smtp.connectiontimeout", "15000");
        p.put("mail.smtp.writetimeout", "15000");
        return s;
    }
}
