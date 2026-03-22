package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ApproveRequestDto;
import com.rstglobal.shield.dns.dto.request.CreateApprovalRequestDto;
import com.rstglobal.shield.dns.dto.response.ApprovalRequestResponse;
import com.rstglobal.shield.dns.service.ApprovalRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * FC-04 — Two-Way Approval Requests.
 *
 * <ul>
 *   <li>POST  /api/v1/dns/approval-requests                 — child requests access to blocked domain</li>
 *   <li>GET   /api/v1/dns/approval-requests/{profileId}     — parent views requests for a profile</li>
 *   <li>POST  /api/v1/dns/approval-requests/{id}/approve    — parent approves with duration</li>
 *   <li>POST  /api/v1/dns/approval-requests/{id}/deny       — parent denies</li>
 * </ul>
 *
 * Gateway injects X-User-Id, X-User-Role, X-Tenant-Id headers.
 */
@RestController
@RequestMapping("/api/v1/dns/approval-requests")
@RequiredArgsConstructor
public class ApprovalRequestController {

    private final ApprovalRequestService approvalService;

    /**
     * Child app submits a permission request for a blocked domain.
     * Accepts any authenticated user (child app uses CHILD_APP role or CUSTOMER role).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ApprovalRequestResponse>> createRequest(
            @RequestHeader("X-User-Id")   String userId,
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @Valid @RequestBody CreateApprovalRequestDto dto) {

        // Override tenantId from header if not supplied in body
        if (dto.getTenantId() == null) {
            dto.setTenantId(UUID.fromString(tenantId));
        }

        ApprovalRequestResponse resp = approvalService.createRequest(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(resp));
    }

    /**
     * Parent views all approval requests for a specific child profile.
     */
    @GetMapping("/{profileId}")
    public ResponseEntity<ApiResponse<List<ApprovalRequestResponse>>> getByProfile(
            @PathVariable UUID profileId,
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "false") boolean pendingOnly) {

        requireCustomer(role);
        List<ApprovalRequestResponse> list = pendingOnly
                ? approvalService.getPendingByProfile(profileId)
                : approvalService.getByProfile(profileId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    /**
     * Parent approves the request with a duration choice.
     * Body: { "durationType": "ONE_HOUR" | "TODAY" | "PERMANENT" }
     */
    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<ApprovalRequestResponse>> approve(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id")   String userId,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody ApproveRequestDto body) {

        requireCustomer(role);
        ApprovalRequestResponse resp = approvalService.approve(id, UUID.fromString(userId), body.getDurationType());
        return ResponseEntity.ok(ApiResponse.ok(resp));
    }

    /**
     * Parent denies the request.
     */
    @PostMapping("/{id}/deny")
    public ResponseEntity<ApiResponse<ApprovalRequestResponse>> deny(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id")   String userId,
            @RequestHeader("X-User-Role") String role) {

        requireCustomer(role);
        ApprovalRequestResponse resp = approvalService.deny(id, UUID.fromString(userId));
        return ResponseEntity.ok(ApiResponse.ok(resp));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
