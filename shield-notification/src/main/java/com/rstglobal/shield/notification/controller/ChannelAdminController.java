package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.notification.dto.request.UpsertChannelRequest;
import com.rstglobal.shield.notification.dto.response.ChannelResponse;
import com.rstglobal.shield.notification.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * GLOBAL_ADMIN or ISP_ADMIN — configure delivery channel credentials.
 *
 *  GLOBAL_ADMIN  → manage platform defaults (tenantId param omitted = platform default)
 *  ISP_ADMIN     → manage their own tenant's overrides
 */
@RestController
@RequestMapping("/api/v1/notifications/admin/channels")
@RequiredArgsConstructor
public class ChannelAdminController {

    private final ChannelAdminService channelAdminService;
    private final EmailService emailService;
    private final WhatsAppService whatsappService;
    private final TelegramService telegramService;

    /** List channels. GLOBAL_ADMIN with no tenantId → platform defaults. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ChannelResponse>>> list(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestParam(required = false) String scope) {
        requireAdmin(role);
        UUID tid = "GLOBAL_ADMIN".equals(role) && "platform".equals(scope) ? null : UUID.fromString(tenantId);
        return ResponseEntity.ok(ApiResponse.ok(channelAdminService.listChannels(tid)));
    }

    /**
     * Create or update a delivery channel.
     * GLOBAL_ADMIN + scope=platform → saves as platform default (tenantId=null).
     */
    @PutMapping
    public ResponseEntity<ApiResponse<ChannelResponse>> upsert(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestParam(required = false) String scope,
            @Valid @RequestBody UpsertChannelRequest req) {
        requireAdmin(role);
        UUID tid = "GLOBAL_ADMIN".equals(role) && "platform".equals(scope) ? null : UUID.fromString(tenantId);
        return ResponseEntity.ok(ApiResponse.ok(channelAdminService.upsertChannel(tid, req)));
    }

    /**
     * Test channel by sending a test message to the given recipient
     * (email address, phone number, or Telegram chat ID).
     */
    @PostMapping("/test")
    public ResponseEntity<ApiResponse<String>> test(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestParam String channelType,
            @RequestParam String testRecipient,
            @RequestParam(required = false) String scope) {
        requireAdmin(role);
        UUID tid = "GLOBAL_ADMIN".equals(role) && "platform".equals(scope) ? null : UUID.fromString(tenantId);
        channelAdminService.testChannel(tid, channelType, testRecipient,
                emailService, whatsappService, telegramService);
        return ResponseEntity.ok(ApiResponse.ok("Test message sent successfully"));
    }

    private void requireAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Admin role required");
        }
    }
}
