package com.rstglobal.shield.rewards.service;

import com.rstglobal.shield.rewards.dto.response.AchievementResponse;
import com.rstglobal.shield.rewards.entity.Achievement;
import com.rstglobal.shield.rewards.entity.RewardBank;
import com.rstglobal.shield.rewards.repository.AchievementRepository;
import com.rstglobal.shield.rewards.repository.RewardBankRepository;
import com.rstglobal.shield.rewards.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AchievementService {

    private static final String FIRST_TASK    = "FIRST_TASK";
    private static final String WEEK_STREAK   = "WEEK_STREAK";
    private static final String MONTH_STREAK  = "MONTH_STREAK";
    private static final String EARLY_BIRD    = "EARLY_BIRD";
    private static final String CONSISTENT    = "CONSISTENT";
    private static final String OVERACHIEVER  = "OVERACHIEVER";
    private static final String PERFECT_WEEK  = "PERFECT_WEEK";

    private final AchievementRepository achievementRepository;
    private final RewardBankRepository rewardBankRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public void checkAndAwardAchievements(UUID profileId) {
        long approvedTaskCount = taskRepository
                .findByProfileIdAndStatus(profileId, "APPROVED")
                .size();

        Optional<RewardBank> bankOpt = rewardBankRepository.findByProfileId(profileId);
        int streakDays = bankOpt.map(RewardBank::getStreakDays).orElse(0);
        int totalPoints = bankOpt.map(RewardBank::getTotalEarnedPoints).orElse(0);

        // FIRST_TASK — first approved task
        if (approvedTaskCount == 1) {
            award(profileId, FIRST_TASK, "First Step!",
                    "Completed your very first task. Great start!", null);
        }

        // WEEK_STREAK — 7-day streak
        if (streakDays >= 7) {
            award(profileId, WEEK_STREAK, "Week Warrior",
                    "Maintained a 7-day task completion streak!", null);
        }

        // MONTH_STREAK — 30-day streak
        if (streakDays >= 30) {
            award(profileId, MONTH_STREAK, "Month Master",
                    "An incredible 30-day task completion streak!", null);
        }

        // EARLY_BIRD — 5 or more tasks completed
        if (approvedTaskCount >= 5) {
            award(profileId, EARLY_BIRD, "Early Bird",
                    "Completed 5 tasks. You're on a roll!", null);
        }

        // CONSISTENT — 20 or more tasks completed
        if (approvedTaskCount >= 20) {
            award(profileId, CONSISTENT, "Consistent Achiever",
                    "Completed 20 tasks. Consistency is key!", null);
        }

        // OVERACHIEVER — 500+ total points earned
        if (totalPoints >= 500) {
            award(profileId, OVERACHIEVER, "Overachiever",
                    "Earned 500 points total. You're amazing!", null);
        }

        // PERFECT_WEEK — 7+ approved tasks in last 7 days
        long tasksThisWeek = taskRepository
                .findByProfileIdAndStatus(profileId, "APPROVED")
                .stream()
                .filter(t -> t.getApprovedAt() != null
                        && t.getApprovedAt().isAfter(OffsetDateTime.now().minusDays(7)))
                .count();
        if (tasksThisWeek >= 7) {
            award(profileId, PERFECT_WEEK, "Perfect Week",
                    "Completed 7 tasks in a single week!", null);
        }
    }

    @Transactional
    public void award(UUID profileId, String badgeType, String badgeName, String description, UUID tenantId) {
        boolean alreadyEarned = achievementRepository
                .findByProfileIdAndBadgeType(profileId, badgeType)
                .isPresent();

        if (!alreadyEarned) {
            Achievement achievement = Achievement.builder()
                    .profileId(profileId)
                    .tenantId(tenantId)
                    .badgeType(badgeType)
                    .badgeName(badgeName)
                    .description(description)
                    .earnedAt(OffsetDateTime.now())
                    .build();
            achievementRepository.save(achievement);
            log.info("Awarded badge {} to profile {}", badgeType, profileId);
        }
    }

    @Transactional(readOnly = true)
    public List<AchievementResponse> listAchievements(UUID profileId) {
        return achievementRepository.findByProfileId(profileId)
                .stream()
                .map(a -> AchievementResponse.builder()
                        .badgeType(a.getBadgeType())
                        .badgeName(a.getBadgeName())
                        .description(a.getDescription())
                        .earnedAt(a.getEarnedAt())
                        .build())
                .collect(Collectors.toList());
    }
}
