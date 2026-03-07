package com.rstglobal.shield.tenant.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.entity.IspBlocklistEntry;
import com.rstglobal.shield.tenant.repository.IspBlocklistRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * ISP Admin endpoints for managing their own domain blocklist.
 * Tenant ID is injected by the gateway as X-Tenant-Id header.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tenants/blocklist")
@RequiredArgsConstructor
@Tag(name = "ISP Blocklist", description = "ISP Admin: manage tenant-specific domain blocklist")
public class TenantBlocklistController {

    private final IspBlocklistRepository blocklistRepo;

    record AddDomainRequest(String domain, String reason) {}

    // ── GET /api/v1/tenants/blocklist ───────────────────────────────────────

    @GetMapping
    @Operation(summary = "List ISP's blocked domains (paginated)")
    public ApiResponse<Page<IspBlocklistEntry>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireIspOrGlobalAdmin(role);
        Page<IspBlocklistEntry> result = blocklistRepo.findByTenantIdOrderByCreatedAtDesc(
                tenantId, PageRequest.of(page, size));
        return ApiResponse.ok(result);
    }

    // ── POST /api/v1/tenants/blocklist ──────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a domain to the ISP's blocklist")
    public ApiResponse<IspBlocklistEntry> add(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestBody AddDomainRequest req) {
        requireIspOrGlobalAdmin(role);

        String domain = req.domain().trim().toLowerCase();
        if (blocklistRepo.existsByTenantIdAndDomain(tenantId, domain)) {
            throw ShieldException.conflict("Domain '" + domain + "' is already in your blocklist");
        }
        IspBlocklistEntry entry = blocklistRepo.save(IspBlocklistEntry.builder()
                .tenantId(tenantId)
                .domain(domain)
                .reason(req.reason())
                .build());
        log.info("ISP {} added domain '{}' to blocklist", tenantId, domain);
        return ApiResponse.ok(entry);
    }

    // ── DELETE /api/v1/tenants/blocklist/{id} ───────────────────────────────

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a domain from the ISP's blocklist")
    public void remove(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable UUID id) {
        requireIspOrGlobalAdmin(role);
        IspBlocklistEntry entry = blocklistRepo.findById(id)
                .orElseThrow(() -> ShieldException.notFound("IspBlocklistEntry", id));
        if (!tenantId.equals(entry.getTenantId())) {
            throw ShieldException.forbidden("This entry does not belong to your tenant");
        }
        blocklistRepo.delete(entry);
        log.info("ISP {} removed domain '{}' from blocklist", tenantId, entry.getDomain());
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    private void requireIspOrGlobalAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN or GLOBAL_ADMIN role required");
        }
    }
}
