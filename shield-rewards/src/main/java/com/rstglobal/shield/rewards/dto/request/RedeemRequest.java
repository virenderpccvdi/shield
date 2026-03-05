package com.rstglobal.shield.rewards.dto.request;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class RedeemRequest {

    @Min(value = 0, message = "Points to redeem cannot be negative")
    private int points;

    @Min(value = 0, message = "Minutes to redeem cannot be negative")
    private int minutes;

    private String description;
}
