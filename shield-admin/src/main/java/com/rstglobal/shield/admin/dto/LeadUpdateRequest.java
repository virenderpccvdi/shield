package com.rstglobal.shield.admin.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class LeadUpdateRequest {
    private String status;
    private String pipelineStage;
    private String notes;
    private UUID assignedTo;
    private String assignedToName;
    private BigDecimal dealValue;
    private OffsetDateTime followUpAt;
    private List<String> tags;
    private String lostReason;
}
