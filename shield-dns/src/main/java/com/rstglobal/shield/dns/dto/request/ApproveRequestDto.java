package com.rstglobal.shield.dns.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Parent sends this when approving an approval request.
 */
@Data
public class ApproveRequestDto {

    /** ONE_HOUR / TODAY / PERMANENT */
    @NotBlank
    private String durationType;
}
