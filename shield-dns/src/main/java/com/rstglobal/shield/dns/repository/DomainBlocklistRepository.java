package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.DomainBlocklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DomainBlocklistRepository extends JpaRepository<DomainBlocklist, UUID> {

    Optional<DomainBlocklist> findByDomainIgnoreCase(String domain);

    List<DomainBlocklist> findByCategoryId(String categoryId);

    boolean existsByDomainIgnoreCase(String domain);

    /**
     * Projection for CategoryCacheLoader — only needs domain + categoryId.
     * Avoids loading full entity for all 5000+ entries.
     */
    @Query("SELECT d.domain as domain, d.categoryId as categoryId FROM DomainBlocklist d")
    List<DomainCategoryProjection> findAllDomainCategoryMappings();

    long countByCategoryId(String categoryId);

    interface DomainCategoryProjection {
        String getDomain();
        String getCategoryId();
    }
}
