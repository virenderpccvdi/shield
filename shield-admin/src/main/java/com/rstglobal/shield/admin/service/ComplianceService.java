package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.request.ComplianceReportRequest;
import com.rstglobal.shield.admin.dto.response.ComplianceReportResponse;
import com.rstglobal.shield.admin.entity.ComplianceReport;
import com.rstglobal.shield.admin.repository.ComplianceReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ComplianceService {

    private static final Set<String> SUPPORTED_REPORT_TYPES = Set.of(
            "BLOCKED_CONTENT_SUMMARY",
            "USER_ACTIVITY",
            "DNS_AUDIT"
    );

    private final ComplianceReportRepository reportRepository;

    @Transactional
    public ComplianceReportResponse generateReport(ComplianceReportRequest req,
                                                   UUID tenantId,
                                                   UUID generatedBy) {
        if (!SUPPORTED_REPORT_TYPES.contains(req.getReportType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported report type: " + req.getReportType()
                    + ". Supported: " + SUPPORTED_REPORT_TYPES);
        }

        Map<String, Object> reportData = buildReportData(req, tenantId);

        ComplianceReport report = ComplianceReport.builder()
                .tenantId(tenantId)
                .reportType(req.getReportType())
                .periodStart(req.getPeriodStart())
                .periodEnd(req.getPeriodEnd())
                .reportData(reportData)
                .generatedBy(generatedBy)
                .generatedAt(OffsetDateTime.now())
                .build();

        report = reportRepository.save(report);
        log.info("Generated {} compliance report for tenant={}, period={}/{}",
                req.getReportType(), tenantId, req.getPeriodStart(), req.getPeriodEnd());
        return toResponse(report);
    }

    public Page<ComplianceReportResponse> listReports(UUID tenantId, Pageable pageable) {
        return reportRepository.findByTenantId(tenantId, pageable).map(this::toResponse);
    }

    public ComplianceReportResponse getReport(UUID id) {
        ComplianceReport report = reportRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Report not found: " + id));
        return toResponse(report);
    }

    /**
     * Builds the report data payload for the given report type.
     * In a production system this would query DNS logs, user activity tables, etc.
     * Here we return a structured placeholder that reflects the correct schema.
     */
    private Map<String, Object> buildReportData(ComplianceReportRequest req, UUID tenantId) {
        Map<String, Object> data = new HashMap<>();
        data.put("tenantId", tenantId.toString());
        data.put("reportType", req.getReportType());
        data.put("periodStart", req.getPeriodStart().toString());
        data.put("periodEnd", req.getPeriodEnd().toString());
        data.put("generatedAt", OffsetDateTime.now().toString());

        switch (req.getReportType()) {
            case "BLOCKED_CONTENT_SUMMARY" -> {
                data.put("totalBlockedRequests", 0);
                data.put("topBlockedCategories", new String[]{});
                data.put("topBlockedDomains", new String[]{});
            }
            case "USER_ACTIVITY" -> {
                data.put("totalUsers", 0);
                data.put("activeUsers", 0);
                data.put("totalDnsQueries", 0);
            }
            case "DNS_AUDIT" -> {
                data.put("totalQueries", 0);
                data.put("blockedQueries", 0);
                data.put("allowedQueries", 0);
                data.put("safeSearchEnforced", 0);
            }
            default -> data.put("summary", "No data available");
        }
        return data;
    }

    private ComplianceReportResponse toResponse(ComplianceReport r) {
        return ComplianceReportResponse.builder()
                .id(r.getId())
                .reportType(r.getReportType())
                .periodStart(r.getPeriodStart())
                .periodEnd(r.getPeriodEnd())
                .reportData(r.getReportData())
                .generatedBy(r.getGeneratedBy())
                .generatedAt(r.getGeneratedAt())
                .fileUrl(r.getFileUrl())
                .build();
    }
}
