package com.rstglobal.shield.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class ComplianceReportResponse {

    private UUID id;
    private String reportType;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private Map<String, Object> reportData;
    private UUID generatedBy;
    private OffsetDateTime generatedAt;
    private String fileUrl;
}
