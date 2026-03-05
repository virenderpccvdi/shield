package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.Achievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AchievementRepository extends JpaRepository<Achievement, UUID> {

    List<Achievement> findByProfileId(UUID profileId);

    Optional<Achievement> findByProfileIdAndBadgeType(UUID profileId, String badgeType);

    long countByProfileId(UUID profileId);
}
