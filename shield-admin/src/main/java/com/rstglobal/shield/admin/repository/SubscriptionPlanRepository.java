package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, UUID> {
    List<SubscriptionPlan> findByActiveTrueOrderBySortOrder();
    Optional<SubscriptionPlan> findByName(String name);
}
