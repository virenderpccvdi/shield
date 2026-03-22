package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.ProfileBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProfileBadgeRepository extends JpaRepository<ProfileBadge, UUID> {

    List<ProfileBadge> findByProfileId(UUID profileId);

    boolean existsByProfileIdAndBadgeId(UUID profileId, String badgeId);

    long countByProfileId(UUID profileId);
}
