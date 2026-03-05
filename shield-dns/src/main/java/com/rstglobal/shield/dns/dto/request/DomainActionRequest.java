package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class DomainActionRequest {
    @NotBlank
    private String domain;

    /** ALLOW | BLOCK */
    @NotBlank
    @Pattern(regexp = "ALLOW|BLOCK")
    private String action;
}
