package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateFamilyRuleRequest {

    @Size(max = 200)
    private String title;

    private String description;

    private String icon;

    private Boolean active;
}
