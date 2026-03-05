package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.notification.dto.request.UpsertChannelRequest;
import com.rstglobal.shield.notification.dto.response.ChannelResponse;
import com.rstglobal.shield.notification.entity.NotificationChannel;
import com.rstglobal.shield.notification.repository.NotificationChannelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Global Admin configures SMTP / WhatsApp / Telegram channels.
 * tenant_id=null = platform default; tenant_id set = ISP-specific override.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelAdminService {

    private final NotificationChannelRepository channelRepo;

    @Transactional(readOnly = true)
    public List<ChannelResponse> listChannels(UUID tenantId) {
        return channelRepo.findAll().stream()
                .filter(c -> tenantId == null
                        ? c.getTenantId() == null
                        : tenantId.equals(c.getTenantId()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ChannelResponse upsertChannel(UUID tenantId, UpsertChannelRequest req) {
        NotificationChannel ch = channelRepo
                .findByTenantIdAndChannelType(tenantId, req.getChannelType())
                .orElse(NotificationChannel.builder()
                        .tenantId(tenantId)
                        .channelType(req.getChannelType())
                        .build());

        ch.setEnabled(req.getEnabled());

        switch (req.getChannelType()) {
            case "SMTP" -> {
                ch.setSmtpHost(req.getSmtpHost());
                ch.setSmtpPort(req.getSmtpPort());
                ch.setSmtpUsername(req.getSmtpUsername());
                if (req.getSmtpPassword() != null) ch.setSmtpPassword(req.getSmtpPassword());
                ch.setSmtpFromEmail(req.getSmtpFromEmail());
                ch.setSmtpFromName(req.getSmtpFromName());
                ch.setSmtpTls(req.getSmtpTls() != null ? req.getSmtpTls() : true);
            }
            case "WHATSAPP" -> {
                ch.setWhatsappApiUrl(req.getWhatsappApiUrl());
                if (req.getWhatsappApiKey() != null) ch.setWhatsappApiKey(req.getWhatsappApiKey());
                ch.setWhatsappFromNumber(req.getWhatsappFromNumber());
            }
            case "TELEGRAM" -> {
                if (req.getTelegramBotToken() != null) ch.setTelegramBotToken(req.getTelegramBotToken());
                ch.setTelegramBotUsername(req.getTelegramBotUsername());
            }
            default -> throw ShieldException.badRequest("Unknown channel type: " + req.getChannelType());
        }

        return toResponse(channelRepo.save(ch));
    }

    @Transactional
    public void testChannel(UUID tenantId, String channelType, String testRecipient,
                             EmailService emailSvc, WhatsAppService waSvc, TelegramService tgSvc) {
        String msg = "Shield notification test — channel is working!";
        boolean sent = switch (channelType) {
            case "SMTP"     -> emailSvc.sendPlainEmail(tenantId, testRecipient, "Shield SMTP Test", msg);
            case "WHATSAPP" -> waSvc.send(tenantId, testRecipient, msg);
            case "TELEGRAM" -> tgSvc.send(tenantId, testRecipient, msg);
            default -> throw ShieldException.badRequest("Unknown channel: " + channelType);
        };
        if (!sent) throw ShieldException.badRequest("Channel test failed — check configuration");
    }

    private ChannelResponse toResponse(NotificationChannel c) {
        return ChannelResponse.builder()
                .id(c.getId())
                .tenantId(c.getTenantId())
                .channelType(c.getChannelType())
                .enabled(c.getEnabled())
                .smtpHost(c.getSmtpHost())
                .smtpPort(c.getSmtpPort())
                .smtpUsername(c.getSmtpUsername())
                .smtpFromEmail(c.getSmtpFromEmail())
                .smtpFromName(c.getSmtpFromName())
                .smtpTls(c.getSmtpTls())
                .whatsappApiUrl(c.getWhatsappApiUrl())
                .whatsappFromNumber(c.getWhatsappFromNumber())
                .telegramBotUsername(c.getTelegramBotUsername())
                .build();
    }
}
