package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Generic internal email endpoint called by other microservices (shield-auth, etc.)
 * to send template-based emails without going through the gateway.
 *
 * NOT exposed via API Gateway.
 */
@Slf4j
@RestController
@RequestMapping("/internal/notifications")
@RequiredArgsConstructor
public class InternalEmailController {

    private final EmailService emailService;

    /**
     * POST /internal/notifications/email
     *
     * Expected body:
     * {
     *   "to":           "user@example.com",
     *   "subject":      "...",
     *   "templateName": "email/welcome-user",
     *   "tenantId":     "uuid-or-null",       (optional)
     *   "variables":    { ... }
     * }
     */
    @PostMapping("/email")
    public ResponseEntity<ApiResponse<Boolean>> sendEmail(
            @RequestBody Map<String, Object> req) {

        String to           = (String) req.get("to");
        String subject      = (String) req.get("subject");
        String templateName = (String) req.get("templateName");
        String tenantIdStr  = (String) req.get("tenantId");

        if (to == null || subject == null || templateName == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.ok(false));
        }

        UUID tenantId = null;
        if (tenantIdStr != null && !tenantIdStr.isBlank()) {
            try { tenantId = UUID.fromString(tenantIdStr); } catch (Exception ignored) {}
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> variables = req.get("variables") instanceof Map<?, ?>
                ? (Map<String, Object>) req.get("variables")
                : Map.of();

        log.info("Internal email request: to={} template={}", to, templateName);

        boolean sent = emailService.sendEmail(tenantId, to, subject, templateName, variables);
        return ResponseEntity.ok(ApiResponse.ok(sent));
    }
}
