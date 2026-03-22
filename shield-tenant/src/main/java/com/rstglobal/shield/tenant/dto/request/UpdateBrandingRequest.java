package com.rstglobal.shield.tenant.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateBrandingRequest {

    @Size(max = 200)
    private String brandName;

    @Pattern(regexp = "^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$",
             message = "brandColor must be a valid hex colour, e.g. #00897B")
    private String brandColor;

    @Size(max = 500)
    private String brandLogoUrl;

    @Email @Size(max = 255)
    private String supportEmail;

    @Size(max = 50)
    private String supportPhone;
}
