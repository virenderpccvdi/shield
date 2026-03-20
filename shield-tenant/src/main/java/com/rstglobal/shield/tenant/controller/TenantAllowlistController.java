package com.rstglobal.shield.tenant.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.entity.IspAllowlistEntry;
import com.rstglobal.shield.tenant.repository.IspAllowlistRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/tenants/allowlist")
@RequiredArgsConstructor
@Tag(name = "ISP Allowlist", description = "ISP Admin: manage tenant-specific domain allowlist")
public class TenantAllowlistController {

    private final IspAllowlistRepository allowlistRepo;

    record AddDomainRequest(String domain, String reason) {}

    @GetMapping
    @Operation(summary = "List ISP's allowed domains (paginated)")
    public ApiResponse<Page<IspAllowlistEntry>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireIspOrGlobalAdmin(role);
        return ApiResponse.ok(allowlistRepo.findByTenantIdOrderByCreatedAtDesc(tenantId, PageRequest.of(page, size)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a domain to the ISP's allowlist")
    public ApiResponse<IspAllowlistEntry> add(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestBody AddDomainRequest req) {
        requireIspOrGlobalAdmin(role);
        String domain = req.domain().trim().toLowerCase();
        if (allowlistRepo.existsByTenantIdAndDomain(tenantId, domain)) {
            throw ShieldException.conflict("Domain '" + domain + "' is already in your allowlist");
        }
        IspAllowlistEntry entry = allowlistRepo.save(IspAllowlistEntry.builder()
                .tenantId(tenantId).domain(domain).reason(req.reason()).build());
        log.info("ISP {} added domain '{}' to allowlist", tenantId, domain);
        return ApiResponse.ok(entry);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a domain from the ISP's allowlist")
    public void remove(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @PathVariable UUID id) {
        requireIspOrGlobalAdmin(role);
        IspAllowlistEntry entry = allowlistRepo.findById(id)
                .orElseThrow(() -> ShieldException.notFound("IspAllowlistEntry", id));
        if (!tenantId.equals(entry.getTenantId())) {
            throw ShieldException.forbidden("This entry does not belong to your tenant");
        }
        allowlistRepo.delete(entry);
        log.info("ISP {} removed domain '{}' from allowlist", tenantId, entry.getDomain());
    }

    private void requireIspOrGlobalAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN or GLOBAL_ADMIN role required");
        }
    }
}
