package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.client.AdGuardClient;
import com.rstglobal.shield.dns.config.ContentCategories;
import com.rstglobal.shield.dns.dto.request.DomainActionRequest;
import com.rstglobal.shield.dns.dto.request.UpdateCategoriesRequest;
import com.rstglobal.shield.dns.dto.request.UpdateListRequest;
import com.rstglobal.shield.dns.dto.response.DnsRulesResponse;
import com.rstglobal.shield.dns.dto.response.PlatformDefaultsResponse;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.entity.PlatformDefaults;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import com.rstglobal.shield.dns.repository.PlatformDefaultsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DnsRulesService {

    private final DnsRulesRepository rulesRepo;
    private final PlatformDefaultsRepository platformRepo;
    private final AdGuardClient adGuard;

    /** Called by profile service (internal) or lazily on first GET. */
    @Transactional
    public DnsRules initRules(UUID tenantId, UUID profileId, String filterLevel) {
        if (rulesRepo.existsByProfileId(profileId)) {
            return rulesRepo.findByProfileId(profileId).get();
        }
        Map<String, Boolean> defaults = ContentCategories.defaultsForFilterLevel(filterLevel);
        DnsRules rules = DnsRules.builder()
                .tenantId(tenantId)
                .profileId(profileId)
                .enabledCategories(defaults)
                .customAllowlist(new ArrayList<>())
                .customBlocklist(new ArrayList<>())
                .timeBudgets(new LinkedHashMap<>())
                .build();
        return rulesRepo.save(rules);
    }

    @Transactional(readOnly = true)
    public DnsRulesResponse getRules(UUID profileId) {
        DnsRules rules = findOrThrow(profileId);
        return toResponse(rules);
    }

    @Transactional
    public DnsRulesResponse updateCategories(UUID profileId, UpdateCategoriesRequest req) {
        DnsRules rules = findOrThrow(profileId);
        Map<String, Boolean> cats = rules.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        cats.putAll(req.getCategories());
        rules.setEnabledCategories(cats);
        DnsRules saved = rulesRepo.save(rules);
        syncToAdGuard(saved);
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateAllowlist(UUID profileId, UpdateListRequest req) {
        DnsRules rules = findOrThrow(profileId);
        rules.setCustomAllowlist(req.getDomains());
        return toResponse(rulesRepo.save(rules));
    }

    @Transactional
    public DnsRulesResponse updateBlocklist(UUID profileId, UpdateListRequest req) {
        DnsRules rules = findOrThrow(profileId);
        rules.setCustomBlocklist(req.getDomains());
        return toResponse(rulesRepo.save(rules));
    }

    @Transactional
    public DnsRulesResponse domainAction(UUID profileId, DomainActionRequest req) {
        DnsRules rules = findOrThrow(profileId);
        String domain = req.getDomain().toLowerCase().trim();
        if ("ALLOW".equals(req.getAction())) {
            List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));
            if (!allow.contains(domain)) allow.add(domain);
            rules.setCustomAllowlist(allow);
            // Remove from blocklist if present
            List<String> block = new ArrayList<>(Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
            block.remove(domain);
            rules.setCustomBlocklist(block);
        } else {
            List<String> block = new ArrayList<>(Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
            if (!block.contains(domain)) block.add(domain);
            rules.setCustomBlocklist(block);
            List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));
            allow.remove(domain);
            rules.setCustomAllowlist(allow);
        }
        return toResponse(rulesRepo.save(rules));
    }

    public Map<String, String> getCategories() {
        return ContentCategories.all();
    }

    // ── Platform defaults ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PlatformDefaultsResponse getPlatformDefaults() {
        PlatformDefaults pd = platformRepo.findAll().stream().findFirst()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        return toPlatformResponse(pd);
    }

    @Transactional
    public PlatformDefaultsResponse updatePlatformCategories(UpdateCategoriesRequest req) {
        PlatformDefaults pd = platformRepo.findAll().stream().findFirst()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        Map<String, Boolean> cats = pd.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        cats.putAll(req.getCategories());
        pd.setEnabledCategories(cats);
        return toPlatformResponse(platformRepo.save(pd));
    }

    @Transactional
    public PlatformDefaultsResponse updatePlatformBlocklist(UpdateListRequest req) {
        PlatformDefaults pd = platformRepo.findAll().stream().findFirst()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        pd.setCustomBlocklist(req.getDomains());
        return toPlatformResponse(platformRepo.save(pd));
    }

    @Transactional
    public PlatformDefaultsResponse updatePlatformAllowlist(UpdateListRequest req) {
        PlatformDefaults pd = platformRepo.findAll().stream().findFirst()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        pd.setCustomAllowlist(req.getDomains());
        return toPlatformResponse(platformRepo.save(pd));
    }

    /**
     * Copy platform blocklist and allowlist domains into ALL existing child profile rules.
     * Domains already present in a profile are skipped (no duplicates).
     * Returns number of profiles updated.
     */
    @Transactional
    public int propagatePlatformRulesToAllProfiles() {
        PlatformDefaults pd = platformRepo.findAll().stream().findFirst()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        List<String> platformBlocklist = Optional.ofNullable(pd.getCustomBlocklist()).orElse(List.of());
        List<String> platformAllowlist = Optional.ofNullable(pd.getCustomAllowlist()).orElse(List.of());
        List<DnsRules> allRules = rulesRepo.findAll();
        for (DnsRules rules : allRules) {
            List<String> block = new ArrayList<>(Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
            for (String d : platformBlocklist) { if (!block.contains(d)) block.add(d); }
            rules.setCustomBlocklist(block);
            List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));
            for (String d : platformAllowlist) { if (!allow.contains(d)) allow.add(d); }
            rules.setCustomAllowlist(allow);
            rulesRepo.save(rules);
        }
        log.info("Propagated platform rules to {} profiles", allRules.size());
        return allRules.size();
    }

    private PlatformDefaultsResponse toPlatformResponse(PlatformDefaults pd) {
        return PlatformDefaultsResponse.builder()
                .enabledCategories(pd.getEnabledCategories())
                .customAllowlist(pd.getCustomAllowlist())
                .customBlocklist(pd.getCustomBlocklist())
                .safesearchEnabled(pd.getSafesearchEnabled())
                .youtubeRestricted(pd.getYoutubeRestricted())
                .adsBlocked(pd.getAdsBlocked())
                .updatedAt(pd.getUpdatedAt())
                .build();
    }

    /**
     * Pause or resume filtering for a profile.
     * Uses a special key "__paused__" in enabledCategories as a toggle flag.
     * When paused, the DNS resolver should check this flag and bypass blocking.
     */
    @Transactional
    public DnsRulesResponse setFilteringPaused(UUID profileId, boolean paused) {
        DnsRules rules = findOrThrow(profileId);
        Map<String, Boolean> cats = rules.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        cats.put("__paused__", paused);
        rules.setEnabledCategories(cats);
        DnsRules saved = rulesRepo.save(rules);
        log.info("Filtering {} for profileId={}", paused ? "paused" : "resumed", profileId);
        return toResponse(saved);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private DnsRules findOrThrow(UUID profileId) {
        return rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
    }

    private void syncToAdGuard(DnsRules rules) {
        // Determine blocked services from categories
        List<String> blocked = new ArrayList<>();
        Map<String, Boolean> cats = Optional.ofNullable(rules.getEnabledCategories()).orElse(Map.of());
        Map<String, String> adguardServiceMap = Map.of(
                "streaming", "youtube",
                "social_media", "instagram",
                "gaming", "twitch",
                "gambling", "betting"
        );
        adguardServiceMap.forEach((category, service) -> {
            if (Boolean.FALSE.equals(cats.get(category))) {
                blocked.add(service);
            }
        });
        // We would need the client ID from profile service; for now log
        log.debug("AdGuard sync: profileId={} blockedServices={}", rules.getProfileId(), blocked);
    }

    private DnsRulesResponse toResponse(DnsRules r) {
        return DnsRulesResponse.builder()
                .profileId(r.getProfileId())
                .enabledCategories(r.getEnabledCategories())
                .customAllowlist(r.getCustomAllowlist())
                .customBlocklist(r.getCustomBlocklist())
                .safesearchEnabled(r.getSafesearchEnabled())
                .youtubeRestricted(r.getYoutubeRestricted())
                .adsBlocked(r.getAdsBlocked())
                .timeBudgets(r.getTimeBudgets())
                .build();
    }
}
