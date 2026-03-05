package com.rstglobal.shield.tenant.repository;

import com.rstglobal.shield.tenant.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    Page<Tenant> findByActiveTrue(Pageable pageable);

    @Query("SELECT t FROM Tenant t WHERE t.active = true AND " +
           "(LOWER(t.name) LIKE LOWER(CONCAT('%', :q, '%')) OR t.slug LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Tenant> search(String q, Pageable pageable);
}
