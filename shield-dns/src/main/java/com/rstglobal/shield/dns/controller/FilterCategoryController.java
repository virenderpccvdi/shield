package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.dns.entity.DomainBlocklist;
import com.rstglobal.shield.dns.entity.FilterCategory;
import com.rstglobal.shield.dns.repository.DomainBlocklistRepository;
import com.rstglobal.shield.dns.repository.FilterCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Category metadata and internal domain-blocklist endpoints.
 *
 * Public:   GET /api/v1/dns/categories/full    → enriched category list with domain counts
 * Internal: GET /internal/dns/domain-blocklist → {domain, categoryId} list for Redis loader
 */
@RestController
@RequiredArgsConstructor
public class FilterCategoryController {

    private final FilterCategoryRepository categoryRepo;
    private final DomainBlocklistRepository domainRepo;

    // ─── Public: enriched category list ─────────────────────────────────────

    /**
     * Returns all filter categories with metadata including domain counts per category.
     * Used by Flutter DNS rules screen and React dashboard to display category cards.
     */
    @GetMapping("/api/v1/dns/categories/full")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getFullCategories() {
        List<FilterCategory> cats = categoryRepo.findAllByOrderByDisplayOrderAsc();

        // Compute domain counts per category
        Map<String, Long> domainCounts = cats.stream()
            .collect(Collectors.toMap(
                FilterCategory::getId,
                c -> domainRepo.countByCategoryId(c.getId())));

        List<Map<String, Object>> result = cats.stream().map(c -> Map.<String, Object>of(
            "id",               c.getId(),
            "name",             c.getName(),
            "description",      c.getDescription() != null ? c.getDescription() : "",
            "riskLevel",        c.getRiskLevel(),
            "blockedStarter",   c.isBlockedStarter(),
            "blockedGrowth",    c.isBlockedGrowth(),
            "blockedEnterprise", c.isBlockedEnterprise(),
            "alwaysBlock",      c.isAlwaysBlock(),
            "iconName",         c.getIconName() != null ? c.getIconName() : "",
            "categoryKey",      c.getCategoryKey() != null ? c.getCategoryKey() : "",
            "domainCount",      domainCounts.getOrDefault(c.getId(), 0L)
        )).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ─── Internal: domain→category dump for CategoryCacheLoader ────────────

    /**
     * Returns all domain→categoryId mappings from dns.domain_blocklist.
     * Called at startup by shield-dns-resolver/CategoryCacheLoader to populate Redis.
     * Not exposed through the gateway (internal only).
     */
    @GetMapping("/internal/dns/domain-blocklist")
    public List<Map<String, String>> getDomainBlocklist() {
        return domainRepo.findAllDomainCategoryMappings().stream()
            .map(p -> Map.of(
                "domain",     p.getDomain().toLowerCase(),
                "categoryId", p.getCategoryId()))
            .collect(Collectors.toList());
    }

    // ─── Internal: single domain lookup ──────────────────────────────────────

    @GetMapping("/internal/dns/domain-category/{domain}")
    public ResponseEntity<Map<String, String>> getDomainCategory(
            @PathVariable String domain) {
        return domainRepo.findByDomainIgnoreCase(domain)
            .map(d -> ResponseEntity.ok(Map.of(
                "domain",     d.getDomain(),
                "categoryId", d.getCategoryId(),
                "appName",    d.getAppName() != null ? d.getAppName() : "")))
            .orElse(ResponseEntity.notFound().build());
    }
}
