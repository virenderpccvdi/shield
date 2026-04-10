package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.InvoicePdfResult;
import com.rstglobal.shield.admin.dto.InvoiceResponse;
import com.rstglobal.shield.admin.service.BillingService;
import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/invoices")
@RequiredArgsConstructor
@Tag(name = "Admin Invoices", description = "Platform-wide invoice management")
public class InvoiceAdminController {

    private final BillingService billingService;

    @GetMapping
    @Operation(summary = "List all invoices (paginated), optionally filtered by tenantId")
    public ApiResponse<Page<InvoiceResponse>> listAll(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID tenantId) {
        requireGlobalAdmin(role);
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<InvoiceResponse> result = tenantId != null
                ? billingService.listInvoicesByTenant(tenantId, pageable)
                : billingService.listAllInvoices(pageable);
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get invoice by ID")
    public ApiResponse<InvoiceResponse> getById(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(billingService.getInvoiceById(id));
    }

    @GetMapping("/{id}/pdf")
    @Operation(summary = "Download invoice PDF — redirects to Stripe PDF or renders HTML invoice")
    public ResponseEntity<byte[]> downloadPdf(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        InvoicePdfResult result = billingService.resolveInvoicePdf(id);
        if (result.isRedirect()) {
            return ResponseEntity.status(302)
                    .header(HttpHeaders.LOCATION, result.getValue())
                    .build();
        }
        // Return HTML invoice page
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(result.getValue().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/{id}/refund")
    @Operation(summary = "Issue a refund for a paid invoice (GLOBAL_ADMIN only)")
    public ApiResponse<String> refundInvoice(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body) {
        requireGlobalAdmin(role);
        String reason = body != null ? body.get("reason") : null;
        billingService.processRefund(id, reason);
        return ApiResponse.ok("Refund processed for invoice " + id);
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
