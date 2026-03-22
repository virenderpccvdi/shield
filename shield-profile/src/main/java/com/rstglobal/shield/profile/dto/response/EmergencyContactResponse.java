package com.rstglobal.shield.profile.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class EmergencyContactResponse {
    private UUID id;
    private UUID profileId;
    private String name;
    private String phone;
    private String email;
    private String relationship;
    private OffsetDateTime createdAt;
}
