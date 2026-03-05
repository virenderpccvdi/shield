package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.request.ComplianceReportRequest;
import com.rstglobal.shield.admin.dto.response.ComplianceReportResponse;
import com.rstglobal.shield.admin.service.ComplianceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceService complianceService;

    /**
     * POST /api/v1/admin/compliance
     * Generate a compliance report for the calling tenant.
     */
    @PostMapping
    public ResponseEntity<ComplianceReportResponse> generateReport(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody ComplianceReportRequest request) {
        ComplianceReportResponse response = complianceService.generateReport(request, tenantId, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /api/v1/admin/compliance
     * List all compliance reports for the calling tenant.
     */
    @GetMapping
    public ResponseEntity<Page<ComplianceReportResponse>> listReports(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            Pageable pageable) {
        return ResponseEntity.ok(complianceService.listReports(tenantId, pageable));
    }

    /**
     * GET /api/v1/admin/compliance/{id}
     * Get a specific compliance report.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ComplianceReportResponse> getReport(@PathVariable UUID id) {
        return ResponseEntity.ok(complianceService.getReport(id));
    }
}
