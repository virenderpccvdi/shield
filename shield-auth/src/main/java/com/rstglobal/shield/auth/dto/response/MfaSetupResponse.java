package com.rstglobal.shield.auth.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class MfaSetupResponse {
    private String       secret;
    private String       qrCodeUrl;    // otpauth:// URI for QR code
    private List<String> backupCodes;
}
