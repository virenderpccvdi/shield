package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.entity.NotificationChannel;
import com.rstglobal.shield.notification.repository.NotificationChannelRepository;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final NotificationChannelRepository channelRepo;
    private final TemplateEngine templateEngine;

    /**
     * Send an HTML email using the tenant's SMTP config (or platform default).
     * Silently logs and returns false if SMTP is not configured or fails.
     */
    public boolean sendEmail(UUID tenantId, String toEmail, String subject,
                              String templateName, Map<String, Object> variables) {
        NotificationChannel channel = channelRepo.findEffective(tenantId, "SMTP").orElse(null);
        if (channel == null || !Boolean.TRUE.equals(channel.getEnabled())) {
            log.debug("SMTP not configured for tenantId={} — skipping email to {}", tenantId, toEmail);
            return false;
        }
        try {
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), channel.getSmtpFromName());
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
        if (channel == null || !Boolean.TRUE.equals(channel.getEnabled())) {
            log.debug("SMTP not configured for tenantId={} — skipping email", tenantId);
            return false;
        }
        try {
            JavaMailSenderImpl sender = buildSender(channel);
            var message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(channel.getSmtpFromEmail(), channel.getSmtpFromName());
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
