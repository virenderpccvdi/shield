package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class UpdateScheduleRequest {
    @NotNull
    private Map<String, List<Integer>> grid;
    private String activePreset;
}
