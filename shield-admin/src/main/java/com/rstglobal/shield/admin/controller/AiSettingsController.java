package com.rstglobal.shield.admin.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rstglobal.shield.admin.entity.AiSettings;
import com.rstglobal.shield.admin.repository.AiSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;

/**
 * GLOBAL_ADMIN endpoints to view and update the platform's AI provider configuration.
 * Changes are propagated to shield-ai Python service automatically.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/ai-settings")
@RequiredArgsConstructor
@Tag(name = "AI Settings", description = "AI provider configuration (GLOBAL_ADMIN only)")
public class AiSettingsController {

    private final AiSettingsRepository aiSettingsRepository;
    private final ObjectMapper objectMapper;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    record AiSettingsRequest(
            String provider,
            String modelName,
            String fastModelName,
            String apiKey,         // plain-text input; stored as-is
            String apiBaseUrl,
            Integer maxTokens,
            Double temperature,
            Boolean enabled
    ) {}

    record AiSettingsResponse(
            UUID id,
            String provider,
            String modelName,
            String fastModelName,
            String apiKeyMasked,   // last 4 chars of key
            String apiBaseUrl,
            int maxTokens,
            double temperature,
            boolean enabled,
            LocalDateTime updatedAt,
            String updatedBy
    ) {}

    record ProviderInfo(String id, String name, List<String> models, String baseUrl) {}

    // ── GET /api/v1/admin/ai-settings ────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Get current AI configuration (GLOBAL_ADMIN only)")
    public ResponseEntity<AiSettingsResponse> getCurrent(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        requireGlobalAdmin(role);
        AiSettings s = aiSettingsRepository.findTopByOrderByUpdatedAtDesc()
                .orElseGet(this::defaultSettings);
        return ResponseEntity.ok(toResponse(s));
    }

    // ── PUT /api/v1/admin/ai-settings ────────────────────────────────────────

    @PutMapping
    @Operation(summary = "Update AI configuration (GLOBAL_ADMIN only)")
    public ResponseEntity<AiSettingsResponse> update(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Name", required = false) String userName,
            @RequestBody AiSettingsRequest req) {
        requireGlobalAdmin(role);

        AiSettings s = aiSettingsRepository.findTopByOrderByUpdatedAtDesc()
                .orElseGet(this::defaultSettings);

        if (req.provider() != null && !req.provider().isBlank())
            s.setProvider(req.provider().toUpperCase());
        if (req.modelName() != null && !req.modelName().isBlank())
            s.setModelName(req.modelName().trim());
        if (req.fastModelName() != null)
            s.setFastModelName(req.fastModelName().isBlank() ? null : req.fastModelName().trim());
        if (req.apiKey() != null && !req.apiKey().isBlank())
            s.setApiKeyEncrypted(req.apiKey().trim());
        if (req.apiBaseUrl() != null)
            s.setApiBaseUrl(req.apiBaseUrl().isBlank() ? null : req.apiBaseUrl().trim());
        if (req.maxTokens() != null && req.maxTokens() > 0)
            s.setMaxTokens(req.maxTokens());
        if (req.temperature() != null)
            s.setTemperature(req.temperature());
        if (req.enabled() != null)
            s.setEnabled(req.enabled());

        s.setUpdatedBy(userName != null ? userName : "GLOBAL_ADMIN");
        s = aiSettingsRepository.save(s);

        log.info("AI settings updated by {} — provider={} model={}", userName, s.getProvider(), s.getModelName());

        // Propagate to shield-ai service asynchronously
        propagateToAiService(s);

        return ResponseEntity.ok(toResponse(s));
    }

    // ── POST /api/v1/admin/ai-settings/test ──────────────────────────────────

    @PostMapping("/test")
    @Operation(summary = "Send a test prompt to verify the configured AI provider (GLOBAL_ADMIN only)")
    public ResponseEntity<Map<String, Object>> test(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        requireGlobalAdmin(role);

        AiSettings s = aiSettingsRepository.findTopByOrderByUpdatedAtDesc()
                .orElseGet(this::defaultSettings);

        if (s.getApiKeyEncrypted() == null || s.getApiKeyEncrypted().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "No API key configured"
            ));
        }

        try {
            String result = callProviderTest(s);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "provider", s.getProvider(),
                    "model", s.getModelName(),
                    "response", result
            ));
        } catch (Exception e) {
            log.warn("AI provider test failed for {}: {}", s.getProvider(), e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "provider", s.getProvider(),
                    "model", s.getModelName(),
                    "error", e.getMessage()
            ));
        }
    }

    // ── GET /api/v1/admin/ai-settings/providers ───────────────────────────────

    @GetMapping("/providers")
    @Operation(summary = "List supported AI providers and their available models")
    public ResponseEntity<List<ProviderInfo>> providers(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        requireGlobalAdmin(role);
        return ResponseEntity.ok(List.of(
                new ProviderInfo("DEEPSEEK", "DeepSeek AI",
                        List.of("deepseek-chat", "deepseek-reasoner"),
                        "https://api.deepseek.com/v1"),
                new ProviderInfo("ANTHROPIC", "Anthropic Claude",
                        List.of("claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"),
                        "https://api.anthropic.com"),
                new ProviderInfo("OPENAI", "OpenAI",
                        List.of("gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"),
                        "https://api.openai.com/v1")
        ));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw new SecurityException("GLOBAL_ADMIN role required");
        }
    }

    private AiSettings defaultSettings() {
        AiSettings s = new AiSettings();
        s.setProvider("DEEPSEEK");
        s.setModelName("deepseek-chat");
        s.setFastModelName("deepseek-chat");
        s.setMaxTokens(2000);
        s.setTemperature(0.7);
        s.setEnabled(true);
        return s;
    }

    private AiSettingsResponse toResponse(AiSettings s) {
        String masked = maskKey(s.getApiKeyEncrypted());
        return new AiSettingsResponse(
                s.getId(),
                s.getProvider(),
                s.getModelName(),
                s.getFastModelName(),
                masked,
                s.getApiBaseUrl(),
                s.getMaxTokens() != null ? s.getMaxTokens() : 2000,
                s.getTemperature() != null ? s.getTemperature() : 0.7,
                Boolean.TRUE.equals(s.getEnabled()),
                s.getUpdatedAt(),
                s.getUpdatedBy()
        );
    }

    private String maskKey(String key) {
        if (key == null || key.length() < 8) return "****";
        return "****" + key.substring(key.length() - 4);
    }

    /**
     * Calls the configured provider with "Say OK" to verify the API key works.
     */
    private String callProviderTest(AiSettings s) {
        RestClient client = RestClient.builder().build();
        String apiKey = s.getApiKeyEncrypted();

        return switch (s.getProvider().toUpperCase()) {
            case "DEEPSEEK" -> {
                String url = (s.getApiBaseUrl() != null && !s.getApiBaseUrl().isBlank())
                        ? s.getApiBaseUrl() + "/chat/completions"
                        : "https://api.deepseek.com/v1/chat/completions";

                Map<String, Object> body = Map.of(
                        "model", s.getModelName(),
                        "messages", List.of(Map.of("role", "user", "content", "Say OK")),
                        "max_tokens", 5
                );

                @SuppressWarnings("unchecked")
                Map<String, Object> resp = client.post()
                        .uri(url)
                        .header("Authorization", "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) resp.get("choices");
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                yield (String) message.get("content");
            }

            case "ANTHROPIC" -> {
                String url = (s.getApiBaseUrl() != null && !s.getApiBaseUrl().isBlank())
                        ? s.getApiBaseUrl() + "/v1/messages"
                        : "https://api.anthropic.com/v1/messages";

                Map<String, Object> body = Map.of(
                        "model", s.getModelName(),
                        "messages", List.of(Map.of("role", "user", "content", "Say OK")),
                        "max_tokens", 5
                );

                @SuppressWarnings("unchecked")
                Map<String, Object> resp = client.post()
                        .uri(url)
                        .header("x-api-key", apiKey)
                        .header("anthropic-version", "2023-06-01")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> content = (List<Map<String, Object>>) resp.get("content");
                yield (String) content.get(0).get("text");
            }

            case "OPENAI" -> {
                String url = (s.getApiBaseUrl() != null && !s.getApiBaseUrl().isBlank())
                        ? s.getApiBaseUrl() + "/chat/completions"
                        : "https://api.openai.com/v1/chat/completions";

                Map<String, Object> body = Map.of(
                        "model", s.getModelName(),
                        "messages", List.of(Map.of("role", "user", "content", "Say OK")),
                        "max_tokens", 5
                );

                @SuppressWarnings("unchecked")
                Map<String, Object> resp = client.post()
                        .uri(url)
                        .header("Authorization", "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) resp.get("choices");
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                yield (String) message.get("content");
            }

            default -> throw new IllegalArgumentException("Unsupported provider: " + s.getProvider());
        };
    }

    /**
     * Writes /tmp/shield_ai_config.json and calls the shield-ai reload endpoint.
     * Fire-and-forget — never blocks the PUT response.
     */
    private void propagateToAiService(AiSettings s) {
        try {
            String baseUrl = resolveBaseUrl(s);
            Map<String, Object> cfg = new LinkedHashMap<>();
            cfg.put("provider", s.getProvider());
            cfg.put("model", s.getModelName());
            cfg.put("fastModel", s.getFastModelName());
            cfg.put("apiKey", s.getApiKeyEncrypted() != null ? s.getApiKeyEncrypted() : "");
            cfg.put("baseUrl", baseUrl);
            cfg.put("maxTokens", s.getMaxTokens());
            cfg.put("temperature", s.getTemperature());

            Path cfgPath = Path.of("/tmp/shield_ai_config.json");
            Files.writeString(cfgPath, objectMapper.writeValueAsString(cfg));
            log.info("Wrote AI config to {}", cfgPath);

            // Notify shield-ai to reload
            try {
                RestClient client = RestClient.builder().build();
                client.post()
                        .uri("http://localhost:8291/ai/config/reload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of())
                        .retrieve()
                        .toBodilessEntity();
                log.info("shield-ai config reload triggered");
            } catch (Exception e) {
                log.warn("Could not reach shield-ai reload endpoint: {}", e.getMessage());
            }
        } catch (IOException e) {
            log.warn("Failed to write shield_ai_config.json: {}", e.getMessage());
        }
    }

    private String resolveBaseUrl(AiSettings s) {
        if (s.getApiBaseUrl() != null && !s.getApiBaseUrl().isBlank()) return s.getApiBaseUrl();
        return switch (s.getProvider().toUpperCase()) {
            case "ANTHROPIC" -> "https://api.anthropic.com";
            case "OPENAI"    -> "https://api.openai.com/v1";
            default           -> "https://api.deepseek.com/v1";
        };
    }
}
