package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.service.AuditLogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Internal endpoint for other Shield microservices to publish audit events.
 * Not exposed through the API gateway (services call directly via Eureka).
 */
@RestController
@RequestMapping("/internal/audit")
@RequiredArgsConstructor
@Validated
public class InternalAuditController {

    private final AuditLogService auditLogService;

    @PostMapping
    public ResponseEntity<Void> log(@Valid @RequestBody AuditEvent event) {
        auditLogService.log(
                event.getAction(),
                event.getResourceType(),
                event.getResourceId(),
                event.getUserId(),
                event.getUserName(),
                event.getIpAddress(),
                event.getDetails()
        );
        return ResponseEntity.accepted().build();
    }

    @Data
    public static class AuditEvent {
        @NotBlank
        private String action;
        @NotBlank
        private String resourceType;
        private String resourceId;
        @NotNull
        private UUID userId;
        private String userName;
        private String ipAddress;
        private Map<String, Object> details;
    }
}
