package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ExtensionRequestDto;
import com.rstglobal.shield.dns.dto.response.ExtensionRequestResponse;
import com.rstglobal.shield.dns.service.ExtensionRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dns")
@RequiredArgsConstructor
public class ExtensionRequestController {

    private final ExtensionRequestService extensionService;

    /** Child app submits a time extension request. */
    @PostMapping("/child/budgets/request")
    public ResponseEntity<ApiResponse<ExtensionRequestResponse>> submitRequest(
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-Profile-Id") String profileId,
            @RequestHeader("X-Customer-Id") String customerId,
            @Valid @RequestBody ExtensionRequestDto req) {
        ExtensionRequestResponse resp = extensionService.submitRequest(
                UUID.fromString(profileId), UUID.fromString(customerId), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(resp));
    }

    /** Parent views pending requests. */
    @GetMapping("/budgets/extension-requests")
    public ResponseEntity<ApiResponse<List<ExtensionRequestResponse>>> getPendingRequests(
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader("X-Customer-Id") String customerId,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(
                extensionService.getPendingRequests(UUID.fromString(customerId))));
    }

    /** Parent approves. */
    @PostMapping("/budgets/extension-requests/{id}/approve")
    public ResponseEntity<ApiResponse<ExtensionRequestResponse>> approve(
            @PathVariable UUID id,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(extensionService.approveRequest(id)));
    }

    /** Parent rejects. */
    @PostMapping("/budgets/extension-requests/{id}/reject")
    public ResponseEntity<ApiResponse<ExtensionRequestResponse>> reject(
            @PathVariable UUID id,
            @RequestHeader("X-User-Role") String role) {
        requireCustomer(role);
        return ResponseEntity.ok(ApiResponse.ok(extensionService.rejectRequest(id)));
    }

    private void requireCustomer(String role) {
        if (!"CUSTOMER".equals(role) && !"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Customer role required");
        }
    }
}
