package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.FamilyInviteRequest;
import com.rstglobal.shield.profile.dto.request.UpdateFamilyRoleRequest;
import com.rstglobal.shield.profile.dto.response.FamilyInviteResponse;
import com.rstglobal.shield.profile.dto.response.FamilyMemberResponse;
import com.rstglobal.shield.profile.service.FamilyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/family")
@RequiredArgsConstructor
@Tag(name = "Family", description = "Family / co-parent management")
public class FamilyController {

    private final FamilyService familyService;

    @PostMapping("/invite")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Send a co-parent / family invite by email")
    public ApiResponse<FamilyInviteResponse> invite(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody FamilyInviteRequest req) {
        requireCustomer(role);
        return ApiResponse.ok(familyService.invite(userId, tenantId, req));
    }

    @PostMapping("/accept")
    @Operation(summary = "Accept a family invite using the invite token")
    public ApiResponse<FamilyMemberResponse> accept(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Role") String role,
            @RequestParam String token) {
        requireCustomer(role);
        return ApiResponse.ok(familyService.acceptInvite(userId, tenantId, token));
    }

    @GetMapping
    @Operation(summary = "List family members and pending invites")
    public ApiResponse<List<Object>> list(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ApiResponse.ok(familyService.listFamily(userId, tenantId));
    }

    @PutMapping("/{memberId}/role")
    @Operation(summary = "Change a family member's role (GUARDIAN only)")
    public ApiResponse<FamilyMemberResponse> updateRole(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID memberId,
            @Valid @RequestBody UpdateFamilyRoleRequest req) {
        requireCustomer(role);
        return ApiResponse.ok(familyService.updateRole(userId, tenantId, memberId, req.getRole()));
    }

    @DeleteMapping("/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a family member (GUARDIAN only)")
    public void remove(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID memberId) {
        requireCustomer(role);
        familyService.removeMember(userId, tenantId, memberId);
    }

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role)) {
            throw ShieldException.forbidden("CUSTOMER role required");
        }
    }
}
