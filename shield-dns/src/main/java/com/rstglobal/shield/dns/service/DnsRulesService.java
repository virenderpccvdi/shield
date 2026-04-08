package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.common.service.FeatureGateService;
import com.rstglobal.shield.dns.config.ContentCategories;
import com.rstglobal.shield.dns.dto.request.DomainActionRequest;
import com.rstglobal.shield.dns.dto.request.UpdateCategoriesRequest;
import com.rstglobal.shield.dns.dto.request.UpdateListRequest;
import com.rstglobal.shield.dns.dto.response.DnsRulesResponse;
import com.rstglobal.shield.dns.dto.response.PlatformDefaultsResponse;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.entity.PlatformDefaults;
import com.rstglobal.shield.dns.entity.RulesAuditLog;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import com.rstglobal.shield.dns.repository.PlatformDefaultsRepository;
import com.rstglobal.shield.dns.repository.RulesAuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DnsRulesService {

    private final DnsRulesRepository rulesRepo;
    private final PlatformDefaultsRepository platformRepo;
    private final FeatureGateService featureGate;
    private final DnsBroadcastService dnsBroadcast;
    private final RulesAuditLogRepository auditLogRepo;

    @Value("${shield.app.domain:shield.rstglobal.in}")
    private String appDomain;

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
                .filterLevel(filterLevel != null ? filterLevel.toUpperCase() : "MODERATE")
                .build();
        return rulesRepo.save(rules);
    }

    @Transactional
    public DnsRulesResponse getRules(UUID profileId, UUID tenantId) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        return toResponse(rules);
    }

    @Transactional
    public DnsRulesResponse updateCategories(UUID profileId, UUID tenantId, UpdateCategoriesRequest req) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        Map<String, Boolean> cats = rules.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        cats.putAll(req.getCategories());
        rules.setEnabledCategories(cats);
        DnsRules saved = rulesRepo.save(rules);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        audit(profileId, tenantId, null, "CATEGORIES_CHANGED",
                "Categories updated: " + req.getCategories().keySet());
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateAllowlist(UUID profileId, UUID tenantId, UpdateListRequest req) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        rules.setCustomAllowlist(req.getDomains());
        DnsRules saved = rulesRepo.save(rules);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        audit(profileId, tenantId, null, "ALLOWLIST_CHANGED",
                req.getDomains().size() + " domains in allowlist");
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateBlocklist(UUID profileId, UUID tenantId, UpdateListRequest req) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        rules.setCustomBlocklist(req.getDomains());
        DnsRules saved = rulesRepo.save(rules);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        audit(profileId, tenantId, null, "BLOCKLIST_CHANGED",
                req.getDomains().size() + " domains in blocklist");
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateCustomLists(UUID profileId, UUID tenantId,
                                               List<String> blocklist, List<String> allowlist) {
        DnsRules rules = findOrInit(profileId, tenantId);
        if (blocklist != null) rules.setCustomBlocklist(blocklist);
        if (allowlist != null) rules.setCustomAllowlist(allowlist);
        DnsRules saved = rulesRepo.save(rules);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateFilterLevel(UUID profileId, UUID tenantId, String filterLevel) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        Map<String, Boolean> cats = rules.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        // Preserve special flags, overlay with new filter level defaults
        Map<String, Boolean> defaults = ContentCategories.defaultsForFilterLevel(filterLevel);
        defaults.forEach(cats::putIfAbsent);
        cats.putAll(defaults);
        // Preserve special flags
        boolean paused = Boolean.TRUE.equals(cats.get("__paused__"));
        boolean scheduleBlocked = Boolean.TRUE.equals(cats.get(ScheduleService.SCHEDULE_BLOCKED_KEY));
        boolean budgetExhausted = Boolean.TRUE.equals(cats.get(BudgetEnforcementService.BUDGET_EXHAUSTED_KEY));
        boolean bedtimeLocked   = Boolean.TRUE.equals(cats.get(BedtimeLockService.BEDTIME_LOCKED_KEY));
        cats.putAll(defaults);
        if (paused) cats.put("__paused__", true);
        if (scheduleBlocked) cats.put(ScheduleService.SCHEDULE_BLOCKED_KEY, true);
        if (budgetExhausted) cats.put(BudgetEnforcementService.BUDGET_EXHAUSTED_KEY, true);
        if (bedtimeLocked)   cats.put(BedtimeLockService.BEDTIME_LOCKED_KEY, true);
        rules.setEnabledCategories(cats);
        rules.setFilterLevel(filterLevel.toUpperCase());
        DnsRules saved = rulesRepo.save(rules);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        audit(profileId, tenantId, null, "FILTER_LEVEL_CHANGED", "Filter level set to " + filterLevel);
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse domainAction(UUID profileId, UUID tenantId, DomainActionRequest req) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
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
        DnsRules saved = rulesRepo.save(rules);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Map<String, String> getCategories() {
        return ContentCategories.all();
    }

    // ── Platform defaults ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PlatformDefaultsResponse getPlatformDefaults() {
        PlatformDefaults pd = platformRepo.findFirstByOrderByUpdatedAtDesc()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        return toPlatformResponse(pd);
    }

    @Transactional
    public PlatformDefaultsResponse updatePlatformCategories(UpdateCategoriesRequest req) {
        PlatformDefaults pd = platformRepo.findFirstByOrderByUpdatedAtDesc()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        Map<String, Boolean> cats = pd.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        cats.putAll(req.getCategories());
        pd.setEnabledCategories(cats);
        return toPlatformResponse(platformRepo.save(pd));
    }

    @Transactional
    public PlatformDefaultsResponse updatePlatformBlocklist(UpdateListRequest req) {
        PlatformDefaults pd = platformRepo.findFirstByOrderByUpdatedAtDesc()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        pd.setCustomBlocklist(req.getDomains());
        return toPlatformResponse(platformRepo.save(pd));
    }

    @Transactional
    public PlatformDefaultsResponse updatePlatformAllowlist(UpdateListRequest req) {
        PlatformDefaults pd = platformRepo.findFirstByOrderByUpdatedAtDesc()
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
        PlatformDefaults pd = platformRepo.findFirstByOrderByUpdatedAtDesc()
                .orElseThrow(() -> ShieldException.notFound("platform-defaults", "singleton"));
        List<String> platformBlocklist = Optional.ofNullable(pd.getCustomBlocklist()).orElse(List.of());
        List<String> platformAllowlist = Optional.ofNullable(pd.getCustomAllowlist()).orElse(List.of());
        List<DnsRules> allRules = rulesRepo.findAll();
        List<DnsRules> modified = allRules.stream()
                .map(rules -> {
                    List<String> block = new ArrayList<>(Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
                    for (String d : platformBlocklist) { if (!block.contains(d)) block.add(d); }
                    rules.setCustomBlocklist(block);
                    List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));
                    for (String d : platformAllowlist) { if (!allow.contains(d)) allow.add(d); }
                    rules.setCustomAllowlist(allow);
                    return rules;
                })
                .collect(java.util.stream.Collectors.toList());
        rulesRepo.saveAll(modified);
        log.info("Propagated platform rules to {} profiles", modified.size());
        return modified.size();
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
    public DnsRulesResponse setFilteringPaused(UUID profileId, UUID tenantId, boolean paused) {
        DnsRules rules = findOrInit(profileId, tenantId);
        Map<String, Boolean> cats = rules.getEnabledCategories();
        if (cats == null) cats = new LinkedHashMap<>();
        cats.put("__paused__", paused);
        rules.setEnabledCategories(cats);
        DnsRules saved = rulesRepo.save(rules);
        log.info("Filtering {} for profileId={}", paused ? "paused" : "resumed", profileId);
        audit(profileId, null, null, paused ? "PAUSE" : "RESUME",
                "Internet filtering " + (paused ? "paused" : "resumed"));
        return toResponse(saved);
    }

    /** Exposes the raw entity — used by controller for clientId lookup. */
    @Transactional(readOnly = true)
    public DnsRules getRulesEntity(UUID profileId, UUID tenantId) {
        return rulesRepo.findByProfileId(profileId)
                .orElseGet(() -> findOrInit(profileId, tenantId));
    }

    /**
     * Fetch recent DNS query activity for a client from the browsing history table.
     * Returns an empty list — full query history is available via BrowsingHistoryService.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getActivity(String clientId, int limit) {
        // DNS query history is stored in dns.browsing_history via shield-dns-resolver's async logger.
        // Use BrowsingHistoryService/BrowsingHistoryController for query log access.
        return List.of();
    }

    /** Force-push current DB rules to AdGuard for a profile. */
    @Transactional
    public DnsRulesResponse forceSync(UUID profileId, UUID tenantId) {
        DnsRules rules = findOrInit(profileId, tenantId);
        dnsBroadcast.broadcastRulesChanged(rules.getProfileId(), tenantId);
        return toResponse(rules);
    }

    /**
     * Push current DB rules to AdGuard by profileId only (no tenantId needed).
     * Used internally after provisioning sets the dnsClientId.
     */
    @Transactional(readOnly = true)
    public void syncRules(UUID profileId) {
        // Rules are synced to shield-dns-resolver via Redis cache — no external sync needed.
        rulesRepo.findByProfileId(profileId).ifPresent(r ->
            dnsBroadcast.broadcastRulesChanged(r.getProfileId(), r.getTenantId()));
    }

    /**
     * Force-sync ALL profiles that have a dnsClientId set.
     * Useful for fixing profiles that were provisioned before the sync bug was fixed.
     */
    @Transactional(readOnly = true)
    public int syncAllProfiles() {
        List<DnsRules> all = rulesRepo.findAll();
        int synced = 0;
        for (DnsRules rules : all) {
            if (rules.getDnsClientId() != null && !rules.getDnsClientId().isBlank()) {
                dnsBroadcast.broadcastRulesChanged(rules.getProfileId(), rules.getTenantId());
                synced++;
            }
        }
        log.info("syncAllProfiles: synced {} profiles to AdGuard", synced);
        return synced;
    }

    // ── Internal API for shield-dns-resolver ────────────────────────────────

    /** Look up DNS rules by dnsClientId — used by shield-dns-resolver Feign client */
    @Transactional(readOnly = true)
    public java.util.Optional<DnsRules> findByDnsClientId(String dnsClientId) {
        return rulesRepo.findByDnsClientId(dnsClientId);
    }

    /** Get full rules for a profile — used by shield-dns-resolver to load into Redis */
    @Transactional(readOnly = true)
    public DnsRulesResponse getRulesForProfile(UUID profileId) {
        return rulesRepo.findByProfileId(profileId)
                .map(this::toResponse)
                .orElse(null);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Finds existing DNS rules or auto-initializes with MODERATE defaults (lazy provision). */
    private DnsRules findOrInit(UUID profileId, UUID tenantId) {
        return rulesRepo.findByProfileId(profileId)
                .orElseGet(() -> {
                    log.info("DNS rules not found for profileId={}, auto-initializing with MODERATE defaults", profileId);
                    return initRules(tenantId, profileId, "MODERATE");
                });
    }

    private DnsRulesResponse toResponse(DnsRules r) {
        String clientId = r.getDnsClientId();
        // Use path-based DoH URL on main domain (valid LE cert) instead of wildcard subdomain
        // Android Private DNS: https://shield.rstglobal.in/dns/{clientId}/dns-query
        String dohUrl = (clientId != null && !clientId.isBlank())
                ? "https://" + appDomain + "/dns/" + clientId + "/dns-query"
                : null;
        return DnsRulesResponse.builder()
                .profileId(r.getProfileId())
                .dnsClientId(clientId)
                .dohUrl(dohUrl)
                .enabledCategories(r.getEnabledCategories())
                .customAllowlist(r.getCustomAllowlist())
                .customBlocklist(r.getCustomBlocklist())
                .safesearchEnabled(r.getSafesearchEnabled())
                .youtubeRestricted(r.getYoutubeRestricted())
                .adsBlocked(r.getAdsBlocked())
                .timeBudgets(r.getTimeBudgets())
                .youtubeSafeMode(r.isYoutubeSafeMode())
                .safeSearch(r.isSafeSearch())
                .filterLevel(r.getFilterLevel() != null ? r.getFilterLevel() : "MODERATE")
                .facebookBlocked(r.isFacebookBlocked())
                .instagramBlocked(r.isInstagramBlocked())
                .tiktokBlocked(r.isTiktokBlocked())
                .build();
    }

    // ── PC-05: YouTube Safe Mode ───────────────────────────────────────────────

    /**
     * Enable or disable YouTube Restricted Mode for a child profile.
     * When enabled, youtube.com / www.youtube.com / m.youtube.com are rewritten
     * via AdGuard DNS CNAME to restrict.youtube.com.
     */
    @Transactional
    public DnsRulesResponse setYoutubeSafeMode(UUID profileId, boolean enabled) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        rules.setYoutubeSafeMode(enabled);
        rules = rulesRepo.save(rules);
        log.info("YouTube safe mode {} for profile={}", enabled ? "ENABLED" : "DISABLED", profileId);
        return toResponse(rules);
    }

    // ── PC-06: Safe Search ────────────────────────────────────────────────────

    /**
     * Enable or disable DNS-level safe search enforcement for a child profile.
     * When enabled, major search engines are rewritten to their safe-search endpoints.
     */
    @Transactional
    public DnsRulesResponse setSafeSearch(UUID profileId, boolean enabled) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        rules.setSafeSearch(enabled);
        rules = rulesRepo.save(rules);
        log.info("Safe search {} for profile={}", enabled ? "ENABLED" : "DISABLED", profileId);
        return toResponse(rules);
    }

    // ── Social Media Blocking ─────────────────────────────────────────────────

    /**
     * Enable or disable DNS-level blocking for a specific social media platform.
     * Supported platforms: "facebook", "instagram", "tiktok"
     * Body: { "platform": "facebook", "enabled": true }
     */
    @Transactional
    public DnsRulesResponse setSocialBlock(UUID profileId, String platform, boolean enabled) {
        DnsRules rules = rulesRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("dns-rules", profileId.toString()));
        switch (platform.toLowerCase()) {
            case "facebook" -> rules.setFacebookBlocked(enabled);
            case "instagram" -> rules.setInstagramBlocked(enabled);
            case "tiktok" -> rules.setTiktokBlocked(enabled);
            default -> throw ShieldException.badRequest("Unknown platform: " + platform + ". Supported: facebook, instagram, tiktok");
        }
        rules = rulesRepo.save(rules);
        applySocialBlock(rules);
        log.info("Social block {} {} for profile={}", platform, enabled ? "ENABLED" : "DISABLED", profileId);
        audit(profileId, null, null, "SOCIAL_BLOCK_CHANGED",
                platform + " blocking " + (enabled ? "enabled" : "disabled"));
        return toResponse(rules);
    }

    private void applySocialBlock(DnsRules rules) {
        // Enforce social media blocks via custom blocklist (picked up by shield-dns-resolver)
        // Facebook: facebook.com, www.facebook.com, m.facebook.com, fb.com
        List<String> block = new ArrayList<>(Optional.ofNullable(rules.getCustomBlocklist()).orElse(List.of()));
        List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));

        applyDomainBlock(block, allow, rules.isFacebookBlocked(),
                List.of("facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "fbcdn.net"));
        applyDomainBlock(block, allow, rules.isInstagramBlocked(),
                List.of("instagram.com", "www.instagram.com", "cdninstagram.com"));
        applyDomainBlock(block, allow, rules.isTiktokBlocked(),
                List.of("tiktok.com", "www.tiktok.com", "tiktokcdn.com", "musical.ly"));

        rules.setCustomBlocklist(block);
        rules.setCustomAllowlist(allow);
        rulesRepo.save(rules);
    }

    private void applyDomainBlock(List<String> block, List<String> allow, boolean blocked, List<String> domains) {
        if (blocked) {
            for (String d : domains) {
                if (!block.contains(d)) block.add(d);
                allow.remove(d);
            }
        } else {
            block.removeAll(domains);
        }
    }

    /**
     * Throws {@link ShieldException#forbidden} if the given feature is disabled for
     * the tenant.  Uses {@link FeatureGateService} which caches results for 5 min.
     */
    private void requireFeature(UUID tenantId, String feature) {
        if (!featureGate.isEnabled(tenantId, feature)) {
            throw ShieldException.forbidden("Feature '" + feature + "' is not enabled for this tenant");
        }
    }

    /** Fire-and-forget audit log write. Never throws — failures are logged only. */
    private void audit(UUID profileId, UUID tenantId, UUID actorId, String action, String detail) {
        try {
            auditLogRepo.save(RulesAuditLog.builder()
                    .profileId(profileId)
                    .tenantId(tenantId)
                    .actorId(actorId)
                    .action(action)
                    .detail(detail)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to write audit log for profile={} action={}: {}", profileId, action, e.getMessage());
        }
    }
}
