package com.rstglobal.shield.profile.dto.request;

import lombok.Data;

@Data
public class UpdateAppControlRequest {
    private Boolean blocked;
    private Integer timeLimitMinutes;
}
