package com.rstglobal.shield.tenant.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data @Builder
public class BulkImportJobResponse {
    private UUID        jobId;
    private UUID        tenantId;
    private String      filename;
    private String      status;
    private String      message;
    private int         totalRows;
    private int         successRows;
    private int         failedRows;
    private List<String> errorDetails;
    private Instant     createdAt;
    private Instant     completedAt;
}
