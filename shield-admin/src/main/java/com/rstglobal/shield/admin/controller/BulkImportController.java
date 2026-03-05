package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.response.BulkImportJobResponse;
import com.rstglobal.shield.admin.service.BulkImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/import")
@RequiredArgsConstructor
public class BulkImportController {

    private final BulkImportService bulkImportService;

    /**
     * POST /api/v1/admin/import
     * Upload a CSV file to bulk-import customers.
     * Expected CSV columns: email, name, [phone], [address]
     */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<BulkImportJobResponse> importCustomers(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestPart("file") MultipartFile file) {
        BulkImportJobResponse response = bulkImportService.importCustomers(file, tenantId, userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    /**
     * GET /api/v1/admin/import/{jobId}
     * Get the status of a bulk import job.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<BulkImportJobResponse> getJobStatus(
            @PathVariable UUID jobId) {
        return ResponseEntity.ok(bulkImportService.getJobStatus(jobId));
    }

    /**
     * GET /api/v1/admin/import
     * List all import jobs for the calling tenant.
     */
    @GetMapping
    public ResponseEntity<Page<BulkImportJobResponse>> listJobs(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            Pageable pageable) {
        return ResponseEntity.ok(bulkImportService.listJobs(tenantId, pageable));
    }
}
