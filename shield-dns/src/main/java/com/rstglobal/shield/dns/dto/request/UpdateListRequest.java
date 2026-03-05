package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class UpdateListRequest {
    @NotNull
    private List<String> domains;
}
