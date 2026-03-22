package com.rstglobal.shield.notification.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class IspCommunicationResponse {
    private UUID    id;
    private UUID    tenantId;
    private String  subject;
    private String  body;
    private String  channel;
    private UUID    sentBy;
    private Instant sentAt;
    private int     recipientCount;
    private String  status;
}
