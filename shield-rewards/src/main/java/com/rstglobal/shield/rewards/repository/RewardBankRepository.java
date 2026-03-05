package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.RewardBank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardBankRepository extends JpaRepository<RewardBank, UUID> {

    Optional<RewardBank> findByProfileId(UUID profileId);
}
