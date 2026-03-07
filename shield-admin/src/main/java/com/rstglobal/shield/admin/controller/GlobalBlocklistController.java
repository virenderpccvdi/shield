package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.entity.GlobalBlocklistEntry;
import com.rstglobal.shield.admin.repository.GlobalBlocklistRepository;
import com.rstglobal.shield.admin.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GLOBAL_ADMIN endpoints for managing the platform-wide domain blocklist.
 * Emergency block: domain is added AND pushed to DNS service immediately.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/blocklist")
@RequiredArgsConstructor
@Tag(name = "Global Blocklist", description = "Platform-wide domain blocklist management (GLOBAL_ADMIN only)")
public class GlobalBlocklistController {

    private final GlobalBlocklistRepository blocklistRepo;
    private final AuditLogService auditLogService;
    private final DiscoveryClient discoveryClient;

    // ── Request DTOs ────────────────────────────────────────────────────────

    record AddDomainsRequest(List<String> domains, String reason) {}
    record EmergencyBlockRequest(String domain, String reason) {}

    // ── GET /api/v1/admin/blocklist/global ─────────────────────────────────

    @GetMapping("/global")
    @Operation(summary = "List all globally blocked domains (paginated)")
    public ResponseEntity<Map<String, Object>> listGlobal(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireGlobalAdmin(role);
        Page<GlobalBlocklistEntry> result = blocklistRepo.findAllByOrderByCreatedAtDesc(
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        Map<String, Object> body = new HashMap<>();
        body.put("content", result.getContent());
        body.put("totalElements", result.getTotalElements());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        return ResponseEntity.ok(body);
    }

    // ── POST /api/v1/admin/blocklist/global ────────────────────────────────

    @PostMapping("/global")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add one or more domains to the global blocklist")
    public ResponseEntity<List<GlobalBlocklistEntry>> addDomains(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Id",   required = false) String userId,
            @RequestHeader(value = "X-User-Name", required = false) String userName,
            @RequestBody AddDomainsRequest req,
            HttpServletRequest httpReq) {
        requireGlobalAdmin(role);

        UUID addedBy = parseUuid(userId);
        List<GlobalBlocklistEntry> added = req.domains().stream()
                .filter(d -> d != null && !d.isBlank())
                .map(d -> d.trim().toLowerCase())
                .filter(d -> !blocklistRepo.existsByDomain(d))
                .map(d -> blocklistRepo.save(GlobalBlocklistEntry.builder()
                        .domain(d)
                        .reason(req.reason())
                        .emergency(false)
                        .addedBy(addedBy)
                        .build()))
                .toList();

        auditLogService.log("GLOBAL_BLOCKLIST_ADD", "GlobalBlocklist", String.join(",", req.domains()),
                addedBy, userName, httpReq.getRemoteAddr(),
                Map.of("count", added.size(), "domains", req.domains()));
        log.info("Added {} domains to global blocklist by {}", added.size(), userName);
        return ResponseEntity.status(HttpStatus.CREATED).body(added);
    }

    // ── DELETE /api/v1/admin/blocklist/global/{id} ─────────────────────────

    @DeleteMapping("/global/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a domain from the global blocklist")
    public ResponseEntity<Void> removeDomain(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Id",   required = false) String userId,
            @RequestHeader(value = "X-User-Name", required = false) String userName,
            @PathVariable UUID id,
            HttpServletRequest httpReq) {
        requireGlobalAdmin(role);
        blocklistRepo.findById(id).ifPresentOrElse(entry -> {
            blocklistRepo.delete(entry);
            auditLogService.log("GLOBAL_BLOCKLIST_REMOVE", "GlobalBlocklist", id.toString(),
                    parseUuid(userId), userName, httpReq.getRemoteAddr(),
                    Map.of("domain", entry.getDomain()));
        }, () -> {
            throw new IllegalArgumentException("Blocklist entry not found: " + id);
        });
        return ResponseEntity.noContent().build();
    }

    // ── POST /api/v1/admin/blocklist/emergency ─────────────────────────────

    @PostMapping("/emergency")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Emergency block: adds domain and pushes to all DNS rules immediately")
    public ResponseEntity<Map<String, Object>> emergencyBlock(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-User-Id",   required = false) String userId,
            @RequestHeader(value = "X-User-Name", required = false) String userName,
            @RequestBody EmergencyBlockRequest req,
            HttpServletRequest httpReq) {
        requireGlobalAdmin(role);

        String domain = req.domain().trim().toLowerCase();
        UUID addedBy = parseUuid(userId);

        // Upsert — if it already exists, mark as emergency
        GlobalBlocklistEntry entry = blocklistRepo.findByDomain(domain)
                .orElse(GlobalBlocklistEntry.builder()
                        .domain(domain)
                        .reason(req.reason())
                        .addedBy(addedBy)
                        .build());
        entry.setEmergency(true);
        if (req.reason() != null && !req.reason().isBlank()) entry.setReason(req.reason());
        blocklistRepo.save(entry);

        auditLogService.log("EMERGENCY_BLOCK", "GlobalBlocklist", domain,
                addedBy, userName, httpReq.getRemoteAddr(),
                Map.of("domain", domain, "reason", req.reason() != null ? req.reason() : ""));
        log.warn("EMERGENCY BLOCK activated for domain '{}' by {}", domain, userName);

        // Asynchronously push to DNS service
        pushEmergencyBlockToDns(domain, req.reason());

        Map<String, Object> response = new HashMap<>();
        response.put("domain", domain);
        response.put("emergency", true);
        response.put("status", "blocked");
        response.put("message", "Domain blocked globally. DNS service notified asynchronously.");
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── Helper: push to DNS service via internal API ───────────────────────

    @Async
    void pushEmergencyBlockToDns(String domain, String reason) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances("SHIELD-DNS");
            if (instances.isEmpty()) {
                log.warn("Emergency block: SHIELD-DNS not found in Eureka — DNS push skipped for '{}'", domain);
                return;
            }
            String baseUrl = instances.get(0).getUri().toString();
            RestClient restClient = RestClient.builder().build();
            Map<String, Object> payload = new HashMap<>();
            payload.put("domain", domain);
            payload.put("reason", reason != null ? reason : "Emergency global block");
            restClient.post()
                    .uri(baseUrl + "/internal/dns/emergency-block")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Emergency block pushed to DNS service for domain '{}'", domain);
        } catch (Exception e) {
            log.warn("Failed to push emergency block to DNS service for '{}': {}", domain, e.getMessage());
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw new SecurityException("GLOBAL_ADMIN role required");
        }
    }

    private UUID parseUuid(String val) {
        try { return val != null ? UUID.fromString(val) : null; } catch (Exception e) { return null; }
    }
}
