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
 * WhatsApp notification via 360dialog / Twilio Business API.
 * Sends plain-text messages to the user's registered WhatsApp number.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppService {

    private final NotificationChannelRepository channelRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    public boolean send(UUID tenantId, String toNumber, String message) {
        NotificationChannel channel = channelRepo.findEffective(tenantId, "WHATSAPP").orElse(null);
        if (channel == null || !Boolean.TRUE.equals(channel.getEnabled())) {
            log.debug("WhatsApp not configured for tenantId={} — skipping", tenantId);
            return false;
        }
        if (toNumber == null || toNumber.isBlank()) {
            log.debug("WhatsApp: no number registered for user");
            return false;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("D360-API-KEY", channel.getWhatsappApiKey());

            // 360dialog Cloud API message format
            Map<String, Object> body = Map.of(
                    "messaging_product", "whatsapp",
                    "to", sanitizeNumber(toNumber),
                    "type", "text",
                    "text", Map.of("body", message)
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    channel.getWhatsappApiUrl() + "/messages",
                    HttpMethod.POST, entity, String.class);

            if (resp.getStatusCode().is2xxSuccessful()) {
                log.info("WhatsApp sent to {}", toNumber);
                return true;
            }
            log.warn("WhatsApp API returned {}: {}", resp.getStatusCode(), resp.getBody());
        } catch (Exception e) {
            log.warn("WhatsApp send failed: {}", e.getMessage());
        }
        return false;
    }

    private String sanitizeNumber(String number) {
        // Strip spaces and ensure it starts with country code
        return number.replaceAll("[^0-9+]", "");
    }
}
