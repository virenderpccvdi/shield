package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateChildProfileRequest {
    @NotBlank(message = "Name is required")
    @Size(min = 1, max = 100, message = "Name must be 1–100 characters")
    private String name;

    private LocalDate dateOfBirth;

    @Pattern(regexp = "TODDLER|CHILD|PRETEEN|TEEN",
             message = "ageGroup must be one of: TODDLER, CHILD, PRETEEN, TEEN")
    private String ageGroup;      // TODDLER | CHILD | PRETEEN | TEEN

    @Pattern(regexp = "MAXIMUM|STRICT|MODERATE|RELAXED|LIGHT|MINIMAL|CUSTOM",
             message = "filterLevel must be one of: MAXIMUM, STRICT, MODERATE, RELAXED, LIGHT, MINIMAL, CUSTOM")
    private String filterLevel;   // MAXIMUM | STRICT | MODERATE | RELAXED | LIGHT | MINIMAL | CUSTOM

    private String avatarUrl;
    private String notes;
}
