package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpsertChannelRequest {
    /** SMTP | WHATSAPP | TELEGRAM */
    @NotBlank private String channelType;
    @NotNull  private Boolean enabled;

    // SMTP
    private String smtpHost;
    private Integer smtpPort;
    private String smtpUsername;
    private String smtpPassword;
    private String smtpFromEmail;
    private String smtpFromName;
    private Boolean smtpTls;

    // WhatsApp
    private String whatsappApiUrl;
    private String whatsappApiKey;
    private String whatsappFromNumber;

    // Telegram
    private String telegramBotToken;
    private String telegramBotUsername;
}
