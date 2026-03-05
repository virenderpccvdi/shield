package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.RewardTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardTransactionRepository extends JpaRepository<RewardTransaction, UUID> {

    List<RewardTransaction> findByProfileIdOrderByCreatedAtDesc(UUID profileId);
}
