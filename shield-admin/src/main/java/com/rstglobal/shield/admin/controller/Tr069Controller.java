package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.request.Tr069WebhookRequest;
import com.rstglobal.shield.admin.dto.response.Tr069ProvisionResponse;
import com.rstglobal.shield.admin.service.Tr069Service;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/tr069")
@RequiredArgsConstructor
public class Tr069Controller {

    private final Tr069Service tr069Service;

    /**
     * POST /api/v1/admin/tr069/webhook
     * Public endpoint - called by ACS (Auto-Configuration Server) on TR-069 INFORM events.
     * X-Tenant-Id may be passed by the ACS or extracted from the device serial lookup.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Tr069ProvisionResponse> webhook(
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId,
            @RequestBody Tr069WebhookRequest request) {
        // Use a well-known default tenant if none provided (ACS webhook may not carry tenant context)
        UUID effectiveTenant = tenantId != null ? tenantId : UUID.fromString("00000000-0000-0000-0000-000000000000");
        return ResponseEntity.ok(tr069Service.handleWebhook(request, effectiveTenant));
    }

    /**
     * GET /api/v1/admin/tr069
     * List all TR-069 provisioned devices for the calling tenant.
     */
    @GetMapping
    public ResponseEntity<Page<Tr069ProvisionResponse>> listProvisions(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            Pageable pageable) {
        return ResponseEntity.ok(tr069Service.listProvisions(tenantId, pageable));
    }

    /**
     * DELETE /api/v1/admin/tr069/{provisionId}
     * Deprovision a device.
     */
    @DeleteMapping("/{provisionId}")
    public ResponseEntity<Void> deprovision(@PathVariable UUID provisionId) {
        tr069Service.deprovision(provisionId);
        return ResponseEntity.noContent().build();
    }
}
