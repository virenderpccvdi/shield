package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.ChildProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

public interface ChildProfileRepository extends JpaRepository<ChildProfile, UUID>,
        JpaSpecificationExecutor<ChildProfile> {
    List<ChildProfile> findByCustomerIdAndActiveTrue(UUID customerId);
    Optional<ChildProfile> findByDnsClientId(String dnsClientId);
    Optional<ChildProfile> findByIdAndActiveTrue(UUID id);
    boolean existsByDnsClientId(String dnsClientId);
    int countByCustomerIdAndActiveTrue(UUID customerId);

    /**
     * Bulk count active child profiles grouped by customer ID.
     * Avoids N+1 queries when building CustomerResponse lists.
     * Returns list of Object[]{customerId, count}.
     */
    @Query("SELECT cp.customerId, COUNT(cp) FROM ChildProfile cp " +
           "WHERE cp.customerId IN :customerIds AND cp.active = true " +
           "GROUP BY cp.customerId")
    List<Object[]> countActiveByCustomerIdIn(@Param("customerIds") Collection<UUID> customerIds);

    default Map<UUID, Integer> countActiveByCustomerIds(Collection<UUID> customerIds) {
        return countActiveByCustomerIdIn(customerIds).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> ((Number) row[1]).intValue()
                ));
    }
    Page<ChildProfile> findByActiveTrue(Pageable pageable);
    Page<ChildProfile> findByNameContainingIgnoreCaseAndActiveTrue(String name, Pageable pageable);
    Page<ChildProfile> findByTenantIdAndActiveTrue(UUID tenantId, Pageable pageable);
    Page<ChildProfile> findByTenantIdAndNameContainingIgnoreCaseAndActiveTrue(UUID tenantId, String name, Pageable pageable);
}
