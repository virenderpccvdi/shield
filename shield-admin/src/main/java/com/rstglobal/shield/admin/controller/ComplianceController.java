package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.dto.request.ComplianceReportRequest;
import com.rstglobal.shield.admin.dto.response.ComplianceReportResponse;
import com.rstglobal.shield.admin.service.ComplianceService;
import com.rstglobal.shield.admin.service.GdprService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceService complianceService;
    private final GdprService gdprService;

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

    // ── GDPR / CCPA / LGPD Endpoints ────────────────────────────────────────

    /**
     * GET /api/v1/admin/compliance/export/{userId}
     * GDPR/CCPA data export — returns all user data as a JSON attachment.
     */
    @GetMapping("/export/{userId}")
    public ResponseEntity<Map<String, Object>> exportUserData(
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Admin-Id", required = false) UUID adminId) {
        Map<String, Object> data = gdprService.exportUserData(userId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename("user-data-" + userId + ".json")
                        .build());
        headers.setContentType(MediaType.APPLICATION_JSON);

        return ResponseEntity.ok().headers(headers).body(data);
    }

    /**
     * POST /api/v1/admin/compliance/forget/{userId}
     * Right to be forgotten — anonymises the user and hard-deletes GPS data.
     */
    @PostMapping("/forget/{userId}")
    public ResponseEntity<Map<String, Object>> forgetUser(
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Admin-Id", required = false) UUID adminId,
            @RequestHeader(value = "X-Admin-Email", required = false) String adminEmail,
            @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        Map<String, Object> result = gdprService.forgetUser(userId, adminId, adminEmail, ipAddress);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/v1/admin/compliance/audit-trail
     * Download audit log as CSV with optional date range filter.
     */
    @GetMapping("/audit-trail")
    public ResponseEntity<byte[]> exportAuditTrail(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @PageableDefault(size = 5000, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        byte[] csv = gdprService.exportAuditTrailCsv(from, to, pageable);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename("audit-trail-" + System.currentTimeMillis() + ".csv")
                        .build());
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));

        return ResponseEntity.ok().headers(headers).body(csv);
    }
}
