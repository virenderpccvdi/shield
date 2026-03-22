package com.rstglobal.shield.tenant.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.dto.response.BulkImportJobResponse;
import com.rstglobal.shield.tenant.entity.BulkImportJob;
import com.rstglobal.shield.tenant.service.BulkImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * IS-03 — Bulk Customer Import
 *
 * POST  /api/v1/tenants/{id}/customers/bulk-import  — upload CSV
 * GET   /api/v1/tenants/{id}/customers/bulk-import/{jobId}  — poll status
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tenants/{id}/customers/bulk-import")
@RequiredArgsConstructor
@Tag(name = "Bulk Import", description = "IS-03 — ISP bulk customer CSV import")
public class BulkImportController {

    private final BulkImportService bulkImportService;

    /**
     * Upload a CSV file of customers to import.
     * CSV format (header optional): email, name, phone, planId
     * Idempotent — re-uploading same email does not create duplicates.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Upload CSV to bulk-import customers (ISP_ADMIN only)")
    public ApiResponse<BulkImportJobResponse> startImport(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID callerTenantId,
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {

        requireIspAdminOrGlobalAdmin(role, callerTenantId, id);

        if (file == null || file.isEmpty()) {
            throw ShieldException.badRequest("CSV file is required and must not be empty");
        }

        String filename = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "import.csv";

        try {
            UUID jobId = bulkImportService.startImport(id, filename, file.getInputStream());
            log.info("BulkImport job {} started by ISP admin (tenant={})", jobId, id);
            return ApiResponse.ok(
                    BulkImportJobResponse.builder()
                            .jobId(jobId)
                            .status("PENDING")
                            .message("Import started. Poll the status endpoint for progress.")
                            .build());
        } catch (java.io.IOException e) {
            throw ShieldException.badRequest("Failed to read uploaded file: " + e.getMessage());
        }
    }

    /**
     * Poll the status of a previously submitted import job.
     */
    @GetMapping("/{jobId}")
    @Operation(summary = "Get bulk-import job status (ISP_ADMIN only)")
    public ApiResponse<BulkImportJobResponse> getStatus(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID callerTenantId,
            @PathVariable UUID id,
            @PathVariable UUID jobId) {

        requireIspAdminOrGlobalAdmin(role, callerTenantId, id);

        BulkImportJob job = bulkImportService.getStatus(jobId, id);
        return ApiResponse.ok(toResponse(job));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private BulkImportJobResponse toResponse(BulkImportJob job) {
        return BulkImportJobResponse.builder()
                .jobId(job.getId())
                .tenantId(job.getTenantId())
                .filename(job.getFilename())
                .status(job.getStatus())
                .totalRows(job.getTotalRows())
                .successRows(job.getSuccessRows())
                .failedRows(job.getFailedRows())
                .errorDetails(job.getErrorDetails())
                .createdAt(job.getCreatedAt())
                .completedAt(job.getCompletedAt())
                .build();
    }

    private void requireIspAdminOrGlobalAdmin(String role, UUID callerTenantId, UUID targetTenantId) {
        if ("GLOBAL_ADMIN".equals(role)) return;
        if ("ISP_ADMIN".equals(role) && targetTenantId != null
                && targetTenantId.equals(callerTenantId)) return;
        throw ShieldException.forbidden("ISP_ADMIN (own tenant) or GLOBAL_ADMIN role required");
    }
}
