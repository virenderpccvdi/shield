package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.UpdateChildProfileRequest;
import com.rstglobal.shield.profile.dto.response.ChildProfileResponse;
import com.rstglobal.shield.profile.service.ChildProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/isp/children")
@RequiredArgsConstructor
@Tag(name = "ISP Child Profiles", description = "Tenant-scoped child profile management for ISP admins")
public class IspProfileController {

    private final ChildProfileService childProfileService;

    @GetMapping
    @Operation(summary = "List child profiles for the ISP tenant")
    public ApiResponse<Page<ChildProfileResponse>> list(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        requireIspAdmin(role);
        UUID tenantId = parseTenantId(tenantIdStr);
        return ApiResponse.ok(childProfileService.listByTenant(tenantId, page, size, search));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a child profile by ID (tenant-scoped)")
    public ApiResponse<ChildProfileResponse> getById(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id) {
        requireIspAdmin(role);
        UUID tenantId = parseTenantId(tenantIdStr);
        return ApiResponse.ok(childProfileService.getByIdIsp(id, tenantId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a child profile (tenant-scoped)")
    public ApiResponse<ChildProfileResponse> update(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id,
            @RequestBody UpdateChildProfileRequest req) {
        requireIspAdmin(role);
        UUID tenantId = parseTenantId(tenantIdStr);
        return ApiResponse.ok(childProfileService.updateIsp(id, tenantId, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a child profile (tenant-scoped)")
    public void delete(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id) {
        requireIspAdmin(role);
        UUID tenantId = parseTenantId(tenantIdStr);
        childProfileService.deleteIsp(id, tenantId);
    }

    private void requireIspAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN role required");
        }
    }

    private UUID parseTenantId(String tenantIdStr) {
        if (tenantIdStr == null || tenantIdStr.isBlank()) {
            throw ShieldException.badRequest("X-Tenant-Id header is required");
        }
        try {
            return UUID.fromString(tenantIdStr);
        } catch (IllegalArgumentException e) {
            throw ShieldException.badRequest("Invalid tenant ID format");
        }
    }
}
