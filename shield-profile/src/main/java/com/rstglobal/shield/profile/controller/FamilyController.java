package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.FamilyInviteRequest;
import com.rstglobal.shield.profile.dto.request.UpdateFamilyRoleRequest;
import com.rstglobal.shield.profile.dto.response.FamilyInviteResponse;
import com.rstglobal.shield.profile.dto.response.FamilyMemberResponse;
import com.rstglobal.shield.profile.service.FamilyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
    @Operation(summary = "Send a co-parent / family invite by email", description = "Generates a 7-day invite token and emails the invitee to join the family group.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Invite sent"),
        @ApiResponse(responseCode = "409", description = "Invitee is already a member")
    })
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
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Invite accepted, member added"),
        @ApiResponse(responseCode = "400", description = "Token invalid or expired")
    })
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

    @DeleteMapping("/invites/{inviteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Cancel a pending co-parent invite (sender only)")
    public void cancelInvite(
            @PathVariable UUID inviteId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        familyService.cancelInvite(inviteId, userId);
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
        if (!"CUSTOMER".equals(role) && !"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Access denied");
        }
    }
}
