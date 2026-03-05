package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findByUserId(UUID userId);
    Page<Customer> findByTenantId(UUID tenantId, Pageable pageable);
    boolean existsByUserId(UUID userId);
}
