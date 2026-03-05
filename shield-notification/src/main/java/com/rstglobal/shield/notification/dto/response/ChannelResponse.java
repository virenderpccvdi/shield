package com.rstglobal.shield.notification.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ChannelResponse {
    private UUID id;
    private UUID tenantId;
    private String channelType;
    private Boolean enabled;
    // SMTP (password never returned)
    private String smtpHost;
    private Integer smtpPort;
    private String smtpUsername;
    private String smtpFromEmail;
    private String smtpFromName;
    private Boolean smtpTls;
    // WhatsApp (api key never returned)
    private String whatsappApiUrl;
    private String whatsappFromNumber;
    // Telegram (bot token never returned)
    private String telegramBotUsername;
}
