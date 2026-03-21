package com.rstglobal.shield.admin.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class LeadUpdateRequest {
    private String status;
    private String notes;
    private UUID assignedTo;
}
