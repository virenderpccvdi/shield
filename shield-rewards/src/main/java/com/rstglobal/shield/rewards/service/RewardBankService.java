package com.rstglobal.shield.rewards.service;

import com.rstglobal.shield.rewards.dto.request.RedeemRequest;
import com.rstglobal.shield.rewards.dto.response.RewardBankResponse;
import com.rstglobal.shield.rewards.dto.response.TransactionResponse;
import com.rstglobal.shield.rewards.entity.RewardBank;
import com.rstglobal.shield.rewards.entity.RewardTransaction;
import com.rstglobal.shield.rewards.repository.RewardBankRepository;
import com.rstglobal.shield.rewards.repository.RewardTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RewardBankService {

    private final RewardBankRepository rewardBankRepository;
    private final RewardTransactionRepository transactionRepository;

    @Transactional
    public RewardBank getOrCreateBank(UUID profileId, UUID tenantId) {
        return rewardBankRepository.findByProfileId(profileId).orElseGet(() -> {
            RewardBank bank = RewardBank.builder()
                    .profileId(profileId)
                    .tenantId(tenantId)
                    .pointsBalance(0)
                    .minutesBalance(0)
                    .totalEarnedPoints(0)
                    .totalEarnedMinutes(0)
                    .streakDays(0)
                    .build();
            bank = rewardBankRepository.save(bank);
            log.info("Created new reward bank for profile {}", profileId);
            return bank;
        });
    }

    @Transactional(readOnly = true)
    public RewardBankResponse getBalance(UUID profileId) {
        RewardBank bank = rewardBankRepository.findByProfileId(profileId)
                .orElseGet(() -> RewardBank.builder()
                        .profileId(profileId)
                        .pointsBalance(0)
                        .minutesBalance(0)
                        .totalEarnedPoints(0)
                        .totalEarnedMinutes(0)
                        .streakDays(0)
                        .build());
        return toResponse(bank);
    }

    @Transactional
    public RewardBankResponse creditReward(UUID profileId, int points, int minutes, UUID taskId, UUID tenantId) {
        RewardBank bank = getOrCreateBank(profileId, tenantId);

        bank.setPointsBalance(bank.getPointsBalance() + points);
        bank.setMinutesBalance(bank.getMinutesBalance() + minutes);
        bank.setTotalEarnedPoints(bank.getTotalEarnedPoints() + points);
        bank.setTotalEarnedMinutes(bank.getTotalEarnedMinutes() + minutes);
        bank = rewardBankRepository.save(bank);

        RewardTransaction tx = RewardTransaction.builder()
                .profileId(profileId)
                .tenantId(tenantId)
                .taskId(taskId)
                .transactionType("EARN")
                .points(points)
                .minutes(minutes)
                .description("Task completed: earned " + points + " points and " + minutes + " minutes")
                .build();
        transactionRepository.save(tx);

        log.info("Credited {} points and {} minutes to profile {}", points, minutes, profileId);
        return toResponse(bank);
    }

    @Transactional
    public RewardBankResponse redeemReward(UUID profileId, RedeemRequest req) {
        RewardBank bank = rewardBankRepository.findByProfileId(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Reward bank not found for profile: " + profileId));

        if (req.getPoints() > 0 && bank.getPointsBalance() < req.getPoints()) {
            throw new IllegalStateException("Insufficient points balance. Available: " + bank.getPointsBalance());
        }
        if (req.getMinutes() > 0 && bank.getMinutesBalance() < req.getMinutes()) {
            throw new IllegalStateException("Insufficient minutes balance. Available: " + bank.getMinutesBalance());
        }

        bank.setPointsBalance(bank.getPointsBalance() - req.getPoints());
        bank.setMinutesBalance(bank.getMinutesBalance() - req.getMinutes());
        bank = rewardBankRepository.save(bank);

        RewardTransaction tx = RewardTransaction.builder()
                .profileId(profileId)
                .transactionType("REDEEM")
                .points(req.getPoints())
                .minutes(req.getMinutes())
                .description(req.getDescription() != null ? req.getDescription() : "Reward redeemed")
                .build();
        transactionRepository.save(tx);

        log.info("Redeemed {} points and {} minutes for profile {}", req.getPoints(), req.getMinutes(), profileId);
        return toResponse(bank);
    }

    @Transactional
    public void updateStreak(UUID profileId) {
        rewardBankRepository.findByProfileId(profileId).ifPresent(bank -> {
            LocalDate today = LocalDate.now();
            LocalDate lastDate = bank.getLastTaskDate();

            if (lastDate == null) {
                bank.setStreakDays(1);
            } else if (lastDate.equals(today)) {
                // Already updated today, no change
                return;
            } else if (lastDate.equals(today.minusDays(1))) {
                bank.setStreakDays(bank.getStreakDays() + 1);
            } else {
                // Streak broken
                bank.setStreakDays(1);
            }

            bank.setLastTaskDate(today);
            rewardBankRepository.save(bank);
            log.info("Updated streak for profile {} to {} days", profileId, bank.getStreakDays());
        });
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> getTransactions(UUID profileId) {
        return transactionRepository.findByProfileIdOrderByCreatedAtDesc(profileId)
                .stream()
                .map(tx -> TransactionResponse.builder()
                        .type(tx.getTransactionType())
                        .points(tx.getPoints())
                        .minutes(tx.getMinutes())
                        .description(tx.getDescription())
                        .createdAt(tx.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    private RewardBankResponse toResponse(RewardBank bank) {
        return RewardBankResponse.builder()
                .profileId(bank.getProfileId())
                .pointsBalance(bank.getPointsBalance())
                .minutesBalance(bank.getMinutesBalance())
                .totalEarnedPoints(bank.getTotalEarnedPoints())
                .totalEarnedMinutes(bank.getTotalEarnedMinutes())
                .streakDays(bank.getStreakDays())
                .lastTaskDate(bank.getLastTaskDate())
                .build();
    }
}
