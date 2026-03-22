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
        // Build inner data with snake_case keys (AdGuard Home API requirement)
        Map<String, Object> innerData = new java.util.LinkedHashMap<>();
        innerData.put("name", displayName);
        innerData.put("ids", List.of(clientId));
        innerData.put("use_global_settings", false);
        innerData.put("use_global_blocked_services", false);
        innerData.put("filtering_enabled", data.filteringEnabled());
        innerData.put("parental_enabled", data.parentalEnabled());
        innerData.put("safebrowsing_enabled", data.safebrowsingEnabled());
        innerData.put("safe_search", data.safeSearch());
        innerData.put("blocked_services", data.blockedServices());
        innerData.put("tags", List.of("device_phone"));
        innerData.put("ignore_querylog", false);
        innerData.put("ignore_statistics", false);
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("name", displayName); // existing client name to look up
        body.put("data", innerData);
        post("/control/clients/update", body);
    }

    /** Delete a client (when child profile is deleted). */
    public void deleteClient(String clientId) {
        if (!enabled) { log.debug("AdGuard disabled — skipping deleteClient({})", clientId); return; }
        post("/control/clients/delete", Map.of("name", clientId));
    }

    /**
     * Fetch DNS query log entries for a specific client.
     * Returns raw AdGuard response as a List of Maps.
     */
    @SuppressWarnings("unchecked")
    public java.util.List<java.util.Map<String, Object>> getQueryLog(String clientId, int limit) {
        if (!enabled) return java.util.List.of();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", authHeader);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = baseUrl + "/control/querylog?limit=" + limit
                    + (clientId != null && !clientId.isBlank() ? "&search=" + clientId : "");
            ResponseEntity<String> resp = rest.exchange(url, HttpMethod.GET, entity, String.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                java.util.Map<String, Object> parsed = mapper.readValue(resp.getBody(),
                        new com.fasterxml.jackson.core.type.TypeReference<>() {});
                Object data = parsed.get("data");
                if (data instanceof java.util.List) {
                    return (java.util.List<java.util.Map<String, Object>>) data;
                }
            }
        } catch (Exception e) {
            log.warn("AdGuard querylog failed: {}", e.getMessage());
        }
        return java.util.List.of();
    }

    // ── DNS Rewrite rules (PC-05 / PC-06) ────────────────────────────────────

    /**
     * Add a DNS CNAME rewrite rule.
     * AdGuard Home API: POST /control/rewrite/add  { "domain": "...", "answer": "..." }
     * Best-effort: errors are logged and swallowed.
     */
    public void setDnsRewrite(String domain, String answer) {
        if (!enabled) { log.debug("AdGuard disabled — skipping setDnsRewrite({} -> {})", domain, answer); return; }
        post("/control/rewrite/add", Map.of("domain", domain, "answer", answer));
        log.debug("DNS rewrite set: {} -> {}", domain, answer);
    }

    /**
     * Remove a DNS rewrite rule for the given domain/answer pair.
     * AdGuard Home API: POST /control/rewrite/delete  { "domain": "...", "answer": "..." }
     * Best-effort: errors are logged and swallowed.
     */
    public void removeDnsRewrite(String domain, String answer) {
        if (!enabled) { log.debug("AdGuard disabled — skipping removeDnsRewrite({})", domain); return; }
        post("/control/rewrite/delete", Map.of("domain", domain, "answer", answer));
        log.debug("DNS rewrite removed: {} -> {}", domain, answer);
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
