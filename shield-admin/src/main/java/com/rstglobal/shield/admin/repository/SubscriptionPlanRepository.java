package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, UUID> {
    List<SubscriptionPlan> findByActiveTrueOrderBySortOrder();
    Optional<SubscriptionPlan> findByName(String name);

    /** Plans for ISP subscriptions (global, no tenant) */
    List<SubscriptionPlan> findByPlanTypeAndActiveTrueOrderBySortOrder(String planType);

    /** Customer plans created by a specific ISP tenant */
    List<SubscriptionPlan> findByTenantIdAndActiveTrueOrderBySortOrder(UUID tenantId);
    List<SubscriptionPlan> findByTenantIdOrderBySortOrder(UUID tenantId);

    /** Look up a plan by its Stripe product ID without scanning the full table. */
    Optional<SubscriptionPlan> findByStripeProductId(String stripeProductId);
}
