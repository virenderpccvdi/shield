package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateChildProfileRequest {
    @NotBlank
    @Size(max = 100)
    private String name;

    private LocalDate dateOfBirth;
    private String ageGroup;      // TODDLER | CHILD | PRETEEN | TEEN
    private String filterLevel;   // MAXIMUM | STRICT | MODERATE | LIGHT | MINIMAL
    private String avatarUrl;
    private String notes;
}
