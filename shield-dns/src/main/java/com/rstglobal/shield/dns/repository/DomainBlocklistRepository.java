package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.DomainBlocklist;
import com.rstglobal.shield.dns.entity.FilterCategory;
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
     * Projection for CategoryCacheLoader — returns domain + categoryKey (e.g. "adult", "gambling").
     * Joins filter_categories to translate numeric categoryId → categoryKey string.
     * Only includes domains whose category has a non-null categoryKey.
     */
    @Query("""
        SELECT d.domain as domain, fc.categoryKey as categoryKey
        FROM DomainBlocklist d
        JOIN FilterCategory fc ON fc.id = d.categoryId
        WHERE fc.categoryKey IS NOT NULL
        """)
    List<DomainCategoryProjection> findAllDomainCategoryMappings();

    long countByCategoryId(String categoryId);

    interface DomainCategoryProjection {
        String getDomain();
        String getCategoryKey();
    }
}
