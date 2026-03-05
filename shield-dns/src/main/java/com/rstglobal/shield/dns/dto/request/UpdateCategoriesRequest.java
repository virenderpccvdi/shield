package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class UpdateCategoriesRequest {
    @NotNull
    private Map<String, Boolean> categories;
}
