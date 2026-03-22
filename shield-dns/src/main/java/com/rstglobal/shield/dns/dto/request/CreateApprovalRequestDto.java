package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * Submitted by the child app when it wants to request access to a blocked domain or app.
 */
@Data
public class CreateApprovalRequestDto {

    /** The blocked domain being requested (required for DOMAIN type). */
    private String domain;

    /** The blocked app package name being requested (required for APP type). */
    private String appPackage;

    /** DOMAIN or APP — defaults to DOMAIN. */
    private String requestType = "DOMAIN";

    @NotNull
    private UUID tenantId;

    @NotNull
    private UUID profileId;

    private UUID customerId;
}
