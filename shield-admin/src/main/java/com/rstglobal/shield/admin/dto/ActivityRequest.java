package com.rstglobal.shield.admin.dto;

import lombok.Data;
import java.time.OffsetDateTime;

@Data
public class ActivityRequest {
    private String type;          // NOTE, CALL, EMAIL, MEETING, TASK
    private String title;
    private String description;
    private String outcome;
    private String performedByName;
    private OffsetDateTime performedAt;
}
