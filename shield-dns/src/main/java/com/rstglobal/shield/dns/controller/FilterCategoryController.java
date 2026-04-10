package com.rstglobal.shield.dns.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.dns.entity.DomainBlocklist;
import com.rstglobal.shield.dns.entity.FilterCategory;
import com.rstglobal.shield.dns.repository.DomainBlocklistRepository;
import com.rstglobal.shield.dns.repository.FilterCategoryRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "DNS Filter Categories", description = "Content category metadata and internal domain-blocklist endpoints")
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
    @Operation(summary = "Get all filter categories with domain counts", description = "Returns all 43 content categories with metadata including risk level, filter-level defaults, and domain count per category.")
    @GetMapping("/api/v1/dns/categories/full")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getFullCategories() {
        List<FilterCategory> cats = categoryRepo.findAllByOrderByDisplayOrderAsc();

        // Compute domain counts per category
        Map<String, Long> domainCounts = cats.stream()
            .collect(Collectors.toMap(
                FilterCategory::getId,
                c -> domainRepo.countByCategoryId(c.getId())));

        List<Map<String, Object>> result = cats.stream().map(c -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id",               c.getId());
            m.put("name",             c.getName());
            m.put("description",      c.getDescription() != null ? c.getDescription() : "");
            m.put("riskLevel",        c.getRiskLevel());
            m.put("blockedStarter",   c.isBlockedStarter());
            m.put("blockedGrowth",    c.isBlockedGrowth());
            m.put("blockedEnterprise", c.isBlockedEnterprise());
            m.put("alwaysBlock",      c.isAlwaysBlock());
            m.put("iconName",         c.getIconName() != null ? c.getIconName() : "");
            m.put("categoryKey",      c.getCategoryKey() != null ? c.getCategoryKey() : "");
            m.put("domainCount",      domainCounts.getOrDefault(c.getId(), 0L));
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ─── Internal: domain→category dump for CategoryCacheLoader ────────────

    /**
     * Returns all domain→categoryId mappings from dns.domain_blocklist.
     * Called at startup by shield-dns-resolver/CategoryCacheLoader to populate Redis.
     * Not exposed through the gateway (internal only).
     */
    @Operation(summary = "Internal: dump all domain-to-category mappings for Redis cache loader", description = "Not exposed through the gateway; called at startup by CategoryCacheLoader to populate the Redis blocklist.")
    @GetMapping("/internal/dns/domain-blocklist")
    public List<Map<String, String>> getDomainBlocklist() {
        return domainRepo.findAllDomainCategoryMappings().stream()
            .map(p -> Map.of(
                "domain",      p.getDomain().toLowerCase(),
                "categoryKey", p.getCategoryKey()))
            .collect(Collectors.toList());
    }

    // ─── Internal: single domain lookup ──────────────────────────────────────

    @Operation(summary = "Internal: look up the category for a single domain")
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
