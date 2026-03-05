package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MfaValidateRequest {

    @NotBlank
    private String mfaToken;

    @NotBlank
    private String code;
}
