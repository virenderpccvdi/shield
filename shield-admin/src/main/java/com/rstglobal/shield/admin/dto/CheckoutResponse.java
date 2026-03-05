package com.rstglobal.shield.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CheckoutResponse {
    private String sessionId;
    private String sessionUrl;
    private String publishableKey;
}
