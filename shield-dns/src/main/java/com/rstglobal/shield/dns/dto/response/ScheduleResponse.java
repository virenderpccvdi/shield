package com.rstglobal.shield.dns.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class ScheduleResponse {
    private UUID profileId;
    private Map<String, List<Integer>> grid;
    private String activePreset;
    private Boolean overrideActive;
    private String overrideType;
    private OffsetDateTime overrideEndsAt;
}
