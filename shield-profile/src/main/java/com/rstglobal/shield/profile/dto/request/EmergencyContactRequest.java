package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class EmergencyContactRequest {
    @NotBlank
    private String name;
    private String phone;
    private String email;
    private String relationship;
}
