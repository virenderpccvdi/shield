package com.rstglobal.shield.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class InvoiceResponse {
    private UUID id;
    private UUID tenantId;
    private UUID customerId;
    private UUID userId;
    private String userEmail;
    private String tenantName;
    private String userName;
    private String planName;
    private BigDecimal amount;
    private String currency;
    private String status;
    private String stripeInvoiceId;
    private String pdfUrl;
    private OffsetDateTime billingPeriodStart;
    private OffsetDateTime billingPeriodEnd;
    private OffsetDateTime createdAt;
}
