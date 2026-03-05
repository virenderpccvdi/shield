package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.entity.NotificationChannel;
import com.rstglobal.shield.notification.repository.NotificationChannelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;

/**
 * Telegram Bot API notification sender.
 * User must first message the bot to get a chat ID, which is stored in alert_preferences.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramService {

    private static final String TELEGRAM_API = "https://api.telegram.org/bot";

    private final NotificationChannelRepository channelRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    public boolean send(UUID tenantId, String chatId, String message) {
        NotificationChannel channel = channelRepo.findEffective(tenantId, "TELEGRAM").orElse(null);
        if (channel == null || !Boolean.TRUE.equals(channel.getEnabled())) {
            log.debug("Telegram not configured for tenantId={}", tenantId);
            return false;
        }
        if (chatId == null || chatId.isBlank()) {
            log.debug("Telegram: no chat ID for user");
            return false;
        }
        String token = channel.getTelegramBotToken();
        if (token == null || token.isBlank()) {
            log.warn("Telegram bot token not set for tenantId={}", tenantId);
            return false;
        }
        try {
            String url = TELEGRAM_API + token + "/sendMessage";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "chat_id", chatId,
                    "text", message,
                    "parse_mode", "HTML"
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> resp = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (resp.getStatusCode().is2xxSuccessful()) {
                log.info("Telegram sent to chatId={}", chatId);
                return true;
            }
            log.warn("Telegram API returned {}: {}", resp.getStatusCode(), resp.getBody());
        } catch (Exception e) {
            log.warn("Telegram send failed: {}", e.getMessage());
        }
        return false;
    }
}
