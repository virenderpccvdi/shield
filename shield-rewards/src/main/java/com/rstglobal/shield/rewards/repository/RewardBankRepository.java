package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.RewardBank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardBankRepository extends JpaRepository<RewardBank, UUID> {

    Optional<RewardBank> findByProfileId(UUID profileId);

    /** Leaderboard: all reward banks for a tenant, sorted by totalEarnedPoints DESC */
    @Query("SELECT r FROM RewardBank r WHERE r.tenantId = :tenantId ORDER BY r.totalEarnedPoints DESC")
    List<RewardBank> findByTenantIdOrderByTotalEarnedPointsDesc(@Param("tenantId") UUID tenantId);
}
