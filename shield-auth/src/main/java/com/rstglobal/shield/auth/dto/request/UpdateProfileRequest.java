package com.rstglobal.shield.auth.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {

    @Size(min = 1, max = 100)
    private String name;

    @Size(max = 20)
    private String phone;
}
