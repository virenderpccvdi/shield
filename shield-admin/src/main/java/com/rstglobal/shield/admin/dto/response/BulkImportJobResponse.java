package com.rstglobal.shield.admin.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class BulkImportJobResponse {

    private UUID id;
    private String status;
    private String jobType;
    private Integer totalRecords;
    private Integer processedRecords;
    private Integer successCount;
    private Integer failureCount;
    private String fileName;
    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;
    private OffsetDateTime createdAt;
}
