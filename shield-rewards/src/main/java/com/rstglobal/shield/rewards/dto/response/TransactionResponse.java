package com.rstglobal.shield.rewards.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class TransactionResponse {

    private String type;
    private int points;
    private int minutes;
    private String description;
    private OffsetDateTime createdAt;
}
