package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class IspCommunicationRequest {
    @NotNull  private UUID   tenantId;
    @NotNull  private UUID   sentBy;
    @NotBlank @Size(max = 300) private String subject;
    @NotBlank private String body;
    /** EMAIL, PUSH, or BOTH — defaults to EMAIL */
    private String channel = "EMAIL";
}
