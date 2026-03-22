package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.notification.dto.request.IspCommunicationRequest;
import com.rstglobal.shield.notification.dto.response.IspCommunicationResponse;
import com.rstglobal.shield.notification.service.IspCommunicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * IS-02: ISP Customer Communication
 * ISP admins broadcast announcements to all their customers via email and/or push.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/notifications/isp-comms")
@RequiredArgsConstructor
@Tag(name = "ISP Communications", description = "Broadcast announcements to tenant customers")
public class IspCommunicationController {

    private final IspCommunicationService ispCommService;

    /**
     * POST /api/v1/notifications/isp-comms/send
     * Send a broadcast communication to all customers of the given tenant.
     */
    @PostMapping("/send")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Send broadcast communication to all tenant customers")
    public ApiResponse<IspCommunicationResponse> send(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID callerTenantId,
            @RequestHeader(value = "X-User-Id",   required = false) UUID callerUserId,
            @Valid @RequestBody IspCommunicationRequest req) {

        requireIspAdminOrGlobalAdmin(role);

        // ISP_ADMIN can only send for their own tenant
        if ("ISP_ADMIN".equals(role) && callerTenantId != null
                && !callerTenantId.equals(req.getTenantId())) {
            throw new IllegalArgumentException("ISP_ADMIN can only send for their own tenant");
        }

        // Auto-populate sentBy from header if not provided in request
        if (req.getSentBy() == null && callerUserId != null) {
            req.setSentBy(callerUserId);
        }

        return ApiResponse.ok(ispCommService.send(req));
    }

    /**
     * GET /api/v1/notifications/isp-comms/history/{tenantId}
     * Paginated history of communications sent by this tenant.
     */
    @GetMapping("/history/{tenantId}")
    @Operation(summary = "Get communication history for a tenant")
    public ApiResponse<PagedResponse<IspCommunicationResponse>> getHistory(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID callerTenantId,
            @PathVariable UUID tenantId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        requireIspAdminOrGlobalAdmin(role);

        if ("ISP_ADMIN".equals(role) && callerTenantId != null
                && !callerTenantId.equals(tenantId)) {
            throw new IllegalArgumentException("ISP_ADMIN can only view their own tenant history");
        }

        Page<IspCommunicationResponse> pageResult =
                ispCommService.getHistory(tenantId, page, size);
        return ApiResponse.ok(PagedResponse.of(pageResult));
    }

    private void requireIspAdminOrGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw new SecurityException("ISP_ADMIN or GLOBAL_ADMIN role required");
        }
    }
}
