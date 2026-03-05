package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.StripeCustomer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StripeCustomerRepository extends JpaRepository<StripeCustomer, UUID> {
    Optional<StripeCustomer> findByUserId(UUID userId);
    Optional<StripeCustomer> findByStripeCustomerId(String stripeCustomerId);
}
