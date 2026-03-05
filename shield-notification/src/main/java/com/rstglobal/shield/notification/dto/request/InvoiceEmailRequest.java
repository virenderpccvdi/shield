package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class InvoiceEmailRequest {
    @NotBlank private String email;
    @NotBlank private String name;
    @NotBlank private String invoiceNumber;
    @NotBlank private String planName;
    @NotBlank private String amount;
    private String currency;
    private String billingPeriodStart;
    private String billingPeriodEnd;
    private String dashboardUrl;
    private String invoiceDate;
    /** Optional — used to resolve SMTP config; null falls back to platform default. */
    private UUID tenantId;
}
