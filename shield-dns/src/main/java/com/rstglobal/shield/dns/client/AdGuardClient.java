package com.rstglobal.shield.dns.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Thin wrapper around the AdGuard Home REST API.
 * All calls are best-effort: if AdGuard is unavailable the error is logged
 * but NOT propagated — Shield stores rules in PostgreSQL as the source of truth.
 */
@Slf4j
@Component
public class AdGuardClient {

    private final RestTemplate rest;
    private final ObjectMapper mapper;
    private final String baseUrl;
    private final String authHeader;
    private final boolean enabled;

    public AdGuardClient(
            @Value("${shield.adguard.url:}") String url,
            @Value("${shield.adguard.user:}") String user,
            @Value("${shield.adguard.pass:}") String pass,
            @Value("${shield.adguard.enabled:false}") boolean enabled) {
        this.rest = new RestTemplate();
        this.mapper = new ObjectMapper();
        this.baseUrl = url;
        this.enabled = enabled && !url.isBlank();
        String credentials = user + ":" + pass;
        this.authHeader = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes());
    }

    /** Create a new DNS client in AdGuard when a child profile is created. */
    public void createClient(String clientId, String displayName, String profileId) {
        if (!enabled) { log.debug("AdGuard disabled — skipping createClient({})", clientId); return; }
        Map<String, Object> body = Map.of(
                "name", displayName,
                "ids", List.of(clientId),
                "use_global_settings", false,
                "filtering_enabled", true,
                "safebrowsing_enabled", true,
                "parental_enabled", true,
                "safe_search", Map.of("enabled", true, "google", true, "bing", true,
                        "duckduckgo", true, "youtube", true),
                "blocked_services", List.of(),
                "tags", List.of("device_phone")
        );
        post("/control/clients/add", body);
    }

    /** Update client settings (categories, blocked services, safe-search). */
    public void updateClient(String clientId, String displayName, AdGuardClientData data) {
        if (!enabled) { log.debug("AdGuard disabled — skipping updateClient({})", clientId); return; }
        Map<String, Object> body = Map.of("name", displayName, "data", data);
        post("/control/clients/update", body);
    }

    /** Delete a client (when child profile is deleted). */
    public void deleteClient(String clientId) {
        if (!enabled) { log.debug("AdGuard disabled — skipping deleteClient({})", clientId); return; }
        post("/control/clients/delete", Map.of("name", clientId));
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private void post(String path, Object body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", authHeader);
            String json = mapper.writeValueAsString(body);
            HttpEntity<String> entity = new HttpEntity<>(json, headers);
            ResponseEntity<String> resp = rest.exchange(baseUrl + path, HttpMethod.POST, entity, String.class);
            if (!resp.getStatusCode().is2xxSuccessful()) {
                log.warn("AdGuard {} returned {}: {}", path, resp.getStatusCode(), resp.getBody());
            }
        } catch (RestClientException | com.fasterxml.jackson.core.JsonProcessingException e) {
            log.warn("AdGuard sync failed for {} — {}: {}", path, e.getClass().getSimpleName(), e.getMessage());
        }
    }

    /** Data payload for updateClient. */
    public record AdGuardClientData(
            boolean filteringEnabled,
            boolean safebrowsingEnabled,
            boolean parentalEnabled,
            Map<String, Object> safeSearch,
            List<String> blockedServices
    ) {}
}
