package com.rstglobal.shield.rewards.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class RewardBankResponse {

    private UUID profileId;
    private int pointsBalance;
    private int minutesBalance;
    private int totalEarnedPoints;
    private int totalEarnedMinutes;
    private int streakDays;
    private LocalDate lastTaskDate;
}
