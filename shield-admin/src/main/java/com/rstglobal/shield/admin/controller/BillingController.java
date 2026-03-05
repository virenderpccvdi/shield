package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.*;
import com.rstglobal.shield.admin.service.BillingService;
import com.rstglobal.shield.admin.service.StripeService;
import com.rstglobal.shield.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/billing")
@RequiredArgsConstructor
@Tag(name = "Billing", description = "Stripe billing and subscription management")
public class BillingController {

    private final BillingService billingService;
    private final StripeService stripeService;

    @PostMapping("/checkout")
    @Operation(summary = "Create Stripe checkout session")
    public ApiResponse<CheckoutResponse> createCheckout(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Name", required = false) String userName,
            @Valid @RequestBody CheckoutRequest req) {
        return ApiResponse.ok(billingService.createCheckout(userId, tenantId,
                email != null ? email : "user@shield.app",
                userName != null ? userName : "Shield User",
                req.getPlanId()));
    }

    @GetMapping("/subscription")
    @Operation(summary = "Get current subscription details")
    public ApiResponse<SubscriptionResponse> getSubscription(
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.ok(billingService.getSubscription(userId));
    }

    @PostMapping("/subscription/cancel")
    @Operation(summary = "Cancel subscription")
    public ApiResponse<String> cancelSubscription(
            @RequestHeader("X-User-Id") UUID userId) {
        billingService.cancelSubscription(userId);
        return ApiResponse.ok("Subscription cancelled");
    }

    @GetMapping("/invoices/my")
    @Operation(summary = "Get my invoices")
    public ApiResponse<Page<InvoiceResponse>> myInvoices(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(billingService.getMyInvoices(userId,
                PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @GetMapping("/invoices/{id}/pdf")
    @Operation(summary = "Download my invoice PDF")
    public ResponseEntity<byte[]> downloadMyInvoicePdf(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id) {
        InvoicePdfResult result = billingService.resolveInvoicePdfForUser(id, userId);
        if (result.isRedirect()) {
            return ResponseEntity.status(302)
                    .header(HttpHeaders.LOCATION, result.getValue())
                    .build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(result.getValue().getBytes(StandardCharsets.UTF_8));
    }
}
