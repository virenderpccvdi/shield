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
    List<ChildProfile> findByCustomerId(UUID customerId);
    Optional<ChildProfile> findByDnsClientId(String dnsClientId);
    boolean existsByDnsClientId(String dnsClientId);
    int countByCustomerId(UUID customerId);
    Page<ChildProfile> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
