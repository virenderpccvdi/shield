package com.rstglobal.shield.tenant.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.dto.request.CreateTenantRequest;
import com.rstglobal.shield.tenant.dto.request.UpdateTenantRequest;
import com.rstglobal.shield.tenant.dto.response.TenantResponse;
import com.rstglobal.shield.tenant.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants", description = "ISP tenant management (GLOBAL_ADMIN only)")
public class TenantController {

    private final TenantService tenantService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new ISP tenant")
    public ApiResponse<TenantResponse> create(
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody CreateTenantRequest req) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.create(req));
    }

    @GetMapping
    @Operation(summary = "List all tenants (paginated)")
    public ApiResponse<PagedResponse<TenantResponse>> list(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        requireGlobalAdmin(role);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.ok(tenantService.list(q, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get tenant by ID")
    public ApiResponse<TenantResponse> getById(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.getById(id));
    }

    @GetMapping("/slug/{slug}")
    @Operation(summary = "Get tenant by slug")
    public ApiResponse<TenantResponse> getBySlug(
            @RequestHeader("X-User-Role") String role,
            @PathVariable String slug) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.getBySlug(slug));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update tenant details")
    public ApiResponse<TenantResponse> update(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTenantRequest req) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(tenantService.update(id, req));
    }

    @PatchMapping("/{id}/features/{feature}")
    @Operation(summary = "Enable or disable a feature flag")
    public ApiResponse<TenantResponse> toggleFeature(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @PathVariable String feature,
            @RequestBody Map<String, Boolean> body) {
        requireGlobalAdmin(role);
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        return ApiResponse.ok(tenantService.toggleFeature(id, feature, enabled));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Soft-delete a tenant")
    public void delete(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        tenantService.delete(id);
    }

    /** ISP Admin: get own tenant details */
    @GetMapping("/me")
    @Operation(summary = "ISP Admin: get own tenant details")
    public ApiResponse<TenantResponse> getMyTenant(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ApiResponse.ok(tenantService.getById(tenantId));
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
