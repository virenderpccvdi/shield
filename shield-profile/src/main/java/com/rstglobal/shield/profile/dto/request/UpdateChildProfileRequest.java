package com.rstglobal.shield.profile.dto.request;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateChildProfileRequest {
    private String name;
    private LocalDate dateOfBirth;
    private String ageGroup;
    private String filterLevel;
    private String avatarUrl;
    private String notes;
}
