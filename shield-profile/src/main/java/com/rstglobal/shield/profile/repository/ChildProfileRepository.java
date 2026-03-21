package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.ChildProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChildProfileRepository extends JpaRepository<ChildProfile, UUID>,
        JpaSpecificationExecutor<ChildProfile> {
    List<ChildProfile> findByCustomerIdAndActiveTrue(UUID customerId);
    Optional<ChildProfile> findByDnsClientId(String dnsClientId);
    Optional<ChildProfile> findByIdAndActiveTrue(UUID id);
    boolean existsByDnsClientId(String dnsClientId);
    int countByCustomerIdAndActiveTrue(UUID customerId);
    Page<ChildProfile> findByActiveTrue(Pageable pageable);
    Page<ChildProfile> findByNameContainingIgnoreCaseAndActiveTrue(String name, Pageable pageable);
    Page<ChildProfile> findByTenantIdAndActiveTrue(UUID tenantId, Pageable pageable);
    Page<ChildProfile> findByTenantIdAndNameContainingIgnoreCaseAndActiveTrue(UUID tenantId, String name, Pageable pageable);
}
