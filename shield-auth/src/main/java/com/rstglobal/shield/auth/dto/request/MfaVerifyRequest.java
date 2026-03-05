package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MfaVerifyRequest {

    @NotBlank
    private String code;
}
