package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.common.service.FeatureGateService;
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
    private final AdGuardClient adGuard;
    private final FeatureGateService featureGate;
    private final DnsBroadcastService dnsBroadcast;

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
        syncToAdGuard(saved);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateAllowlist(UUID profileId, UUID tenantId, UpdateListRequest req) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        rules.setCustomAllowlist(req.getDomains());
        DnsRules saved = rulesRepo.save(rules);
        syncToAdGuard(saved);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateBlocklist(UUID profileId, UUID tenantId, UpdateListRequest req) {
        requireFeature(tenantId, "dns_filtering");
        DnsRules rules = findOrInit(profileId, tenantId);
        rules.setCustomBlocklist(req.getDomains());
        DnsRules saved = rulesRepo.save(rules);
        syncToAdGuard(saved);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
        return toResponse(saved);
    }

    @Transactional
    public DnsRulesResponse updateCustomLists(UUID profileId, UUID tenantId,
                                               List<String> blocklist, List<String> allowlist) {
        DnsRules rules = findOrInit(profileId, tenantId);
        if (blocklist != null) rules.setCustomBlocklist(blocklist);
        if (allowlist != null) rules.setCustomAllowlist(allowlist);
        DnsRules saved = rulesRepo.save(rules);
        syncToAdGuard(saved);
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
        DnsRules saved = rulesRepo.save(rules);
        syncToAdGuard(saved);
        dnsBroadcast.broadcastRulesChanged(saved.getProfileId(), tenantId);
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
        syncToAdGuard(saved);
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
        return toResponse(saved);
    }

    /** Exposes the raw entity — used by controller for clientId lookup. */
    @Transactional(readOnly = true)
    public DnsRules getRulesEntity(UUID profileId, UUID tenantId) {
        return rulesRepo.findByProfileId(profileId)
                .orElseGet(() -> findOrInit(profileId, tenantId));
    }

    /** Fetch DNS query log from AdGuard filtered by clientId. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getActivity(String clientId, int limit) {
        // Fetch more entries to account for filtering
        List<Map<String, Object>> raw = adGuard.getQueryLog(null, Math.min(limit * 5, 500));
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> entry : raw) {
            // client_id is set when client connects via DoH URL /dns-query/{clientId}
            String entryClientId = String.valueOf(entry.getOrDefault("client_id", ""));
            String entryClient   = String.valueOf(entry.getOrDefault("client", ""));
            if (clientId != null && !clientId.isBlank()) {
                if (!clientId.equals(entryClientId) && !entryClient.contains(clientId)) continue;
            }

            Map<String, Object> item = new java.util.LinkedHashMap<>();
            @SuppressWarnings("unchecked")
            Map<String, Object> question = (Map<String, Object>) entry.get("question");
            String domain = question != null ? String.valueOf(question.getOrDefault("name", "")) : "";
            // Remove trailing dot from domain
            if (domain.endsWith(".")) domain = domain.substring(0, domain.length() - 1);
            String reason = String.valueOf(entry.getOrDefault("reason", ""));
            String time   = String.valueOf(entry.getOrDefault("time", ""));

            item.put("domain", domain);
            item.put("action", reason.startsWith("Filtered") ? "BLOCKED" : "ALLOWED");
            item.put("reason", reason);
            item.put("timestamp", time);
            // Extract block rule if present (rules is a List in AdGuard log)
            Object rulesObj = entry.get("rules");
            if (rulesObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> rulesList = (List<Map<String, Object>>) rulesObj;
                if (!rulesList.isEmpty()) {
                    item.put("rule", rulesList.get(0).getOrDefault("text", ""));
                }
            }
            result.add(item);
            if (result.size() >= limit) break;
        }
        return result;
    }

    /** Force-push current DB rules to AdGuard for a profile. */
    @Transactional
    public DnsRulesResponse forceSync(UUID profileId, UUID tenantId) {
        DnsRules rules = findOrInit(profileId, tenantId);
        syncToAdGuard(rules);
        return toResponse(rules);
    }

    /**
     * Push current DB rules to AdGuard by profileId only (no tenantId needed).
     * Used internally after provisioning sets the dnsClientId.
     */
    @Transactional(readOnly = true)
    public void syncRules(UUID profileId) {
        rulesRepo.findByProfileId(profileId).ifPresent(this::syncToAdGuard);
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
                syncToAdGuard(rules);
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

    /** Fire-and-forget AdGuard sync — runs in background so API returns immediately. */
    private void syncToAdGuard(DnsRules rules) {
        java.util.concurrent.CompletableFuture.runAsync(() -> syncToAdGuardInternal(rules));
    }

    private void syncToAdGuardInternal(DnsRules rules) {
        String clientId = rules.getDnsClientId();
        if (clientId == null || clientId.isBlank()) {
            log.warn("syncToAdGuard: no dnsClientId on rules for profileId={} — skipping AdGuard sync", rules.getProfileId());
            return;
        }

        try {

        Map<String, Boolean> cats = Optional.ofNullable(rules.getEnabledCategories()).orElse(Map.of());

        // If schedule enforcement, budget exhaustion, bedtime lock, OR pause flag is active,
        // disable filtering entirely (filteringEnabled=false in AdGuard blocks ALL DNS for the client)
        boolean scheduleBlocked = Boolean.TRUE.equals(cats.get(ScheduleService.SCHEDULE_BLOCKED_KEY));
        boolean budgetExhausted = Boolean.TRUE.equals(cats.get(BudgetEnforcementService.BUDGET_EXHAUSTED_KEY));
        boolean bedtimeLocked   = Boolean.TRUE.equals(cats.get(BedtimeLockService.BEDTIME_LOCKED_KEY));
        boolean paused = Boolean.TRUE.equals(cats.get("__paused__"));
        if (scheduleBlocked || budgetExhausted || bedtimeLocked || paused) {
            AdGuardClient.AdGuardClientData data = new AdGuardClient.AdGuardClientData(
                    false, false, false,
                    Map.of("enabled", false, "google", false, "bing", false,
                            "duckduckgo", false, "youtube", false),
                    List.of()
            );
            log.info("AdGuard sync: profileId={} clientId={} — BLOCKED (scheduleBlocked={} budgetExhausted={} bedtimeLocked={} paused={})",
                    rules.getProfileId(), clientId, scheduleBlocked, budgetExhausted, bedtimeLocked, paused);
            adGuard.updateClient(clientId, clientId, data);
            return;
        }

        // Determine blocked services from categories
        // Maps internal category slug → AdGuard service IDs (verified against AdGuard Home service list)
        List<String> blocked = new ArrayList<>();
        java.util.List<String[]> serviceMapping = java.util.List.of(
            // Social media (both legacy "social" slug and current "social_media")
            new String[]{"social_media", "instagram", "facebook", "twitter", "tiktok", "snapchat",
                         "reddit", "pinterest", "vk", "tumblr", "bluesky", "linkedin", "mastodon"},
            new String[]{"social",       "instagram", "facebook", "twitter", "tiktok", "snapchat", "reddit"},
            new String[]{"tiktok",       "tiktok"},
            // Streaming
            new String[]{"streaming",    "youtube", "netflix", "amazon_streaming", "hulu", "disneyplus",
                         "twitch", "max", "crunchyroll", "peacock_tv", "paramountplus",
                         "apple_streaming", "dailymotion", "vimeo"},
            new String[]{"live_streaming","twitch", "youtube", "bigo_live", "dailymotion"},
            new String[]{"music",        "spotify", "soundcloud", "deezer", "tidal"},
            new String[]{"youtube",      "youtube"},
            // Gaming
            new String[]{"gaming",       "twitch", "steam", "roblox", "minecraft",
                         "battle_net", "epic_games", "nintendo", "xboxlive", "playstation",
                         "leagueoflegends", "riot_games", "valorant", "electronic_arts"},
            new String[]{"online_gaming","twitch", "steam", "roblox", "riot_games",
                         "leagueoflegends", "valorant", "battle_net"},
            new String[]{"game_stores",  "steam", "playstore", "nintendo", "epic_games"},
            // Gambling
            new String[]{"gambling",     "betway", "betano", "betfair"},
            // Messaging / chat
            new String[]{"messaging",    "whatsapp", "telegram", "viber", "signal", "line", "kakaotalk"},
            new String[]{"chat",         "discord", "telegram", "whatsapp", "wechat", "kik", "slack"},
            // Dating
            new String[]{"dating",       "tinder", "plenty_of_fish"},
            // Adult / explicit
            new String[]{"adult",        "onlyfans"},
            new String[]{"pornography",  "onlyfans"},
            // Privacy bypass (icloud_private_relay, proton VPN, privacy.com)
            new String[]{"vpn_proxy",    "icloud_private_relay", "proton", "privacy"},
            // AI tools
            new String[]{"ai_tools",     "chatgpt", "gemini", "copilot", "claude", "grok",
                         "deepseek", "perplexity", "manus", "meta_ai"}
        );
        for (String[] entry : serviceMapping) {
            String category = entry[0];
            if (Boolean.FALSE.equals(cats.get(category))) {
                for (int i = 1; i < entry.length; i++) {
                    String svc = entry[i];
                    if (!blocked.contains(svc)) blocked.add(svc);
                }
            }
        }

        boolean safesearch = Boolean.TRUE.equals(rules.getSafesearchEnabled());
        boolean ytRestricted = Boolean.TRUE.equals(rules.getYoutubeRestricted());
        Map<String, Object> safeSearchMap = new java.util.LinkedHashMap<>();
        safeSearchMap.put("enabled", safesearch);
        safeSearchMap.put("google", safesearch);
        safeSearchMap.put("bing", safesearch);
        safeSearchMap.put("duckduckgo", safesearch);
        safeSearchMap.put("youtube", ytRestricted);
        safeSearchMap.put("yandex", safesearch);
        safeSearchMap.put("pixabay", false);
        safeSearchMap.put("ecosia", false);
        AdGuardClient.AdGuardClientData data = new AdGuardClient.AdGuardClientData(
                true,
                true,
                true,
                safeSearchMap,
                blocked
        );
        log.debug("AdGuard sync: profileId={} clientId={} blockedServices={}", rules.getProfileId(), clientId, blocked);
        adGuard.updateClient(clientId, clientId, data);

        // PC-05: YouTube Safe Mode — DNS CNAME rewrites
        applyYoutubeRewrites(rules.isYoutubeSafeMode());
        // PC-06: Safe Search — DNS CNAME rewrites
        applySafeSearchRewrites(rules.isSafeSearch());

        } catch (Exception e) {
            log.warn("AdGuard sync failed for profile={} clientId={} — DB saved, sync skipped: {}", rules.getProfileId(), clientId, e.getMessage());
        }
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
        applyYoutubeRewrites(enabled);
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
        applySafeSearchRewrites(enabled);
        log.info("Safe search {} for profile={}", enabled ? "ENABLED" : "DISABLED", profileId);
        return toResponse(rules);
    }

    // ── DNS Rewrite helpers ───────────────────────────────────────────────────

    private void applyYoutubeRewrites(boolean enable) {
        if (enable) {
            adGuard.setDnsRewrite("youtube.com", "restrict.youtube.com");
            adGuard.setDnsRewrite("www.youtube.com", "restrict.youtube.com");
            adGuard.setDnsRewrite("m.youtube.com", "restrict.youtube.com");
        } else {
            adGuard.removeDnsRewrite("youtube.com", "restrict.youtube.com");
            adGuard.removeDnsRewrite("www.youtube.com", "restrict.youtube.com");
            adGuard.removeDnsRewrite("m.youtube.com", "restrict.youtube.com");
        }
    }

    private void applySafeSearchRewrites(boolean enable) {
        if (enable) {
            adGuard.setDnsRewrite("www.google.com", "forcesafesearch.google.com");
            adGuard.setDnsRewrite("google.com", "forcesafesearch.google.com");
            adGuard.setDnsRewrite("www.bing.com", "strict.bing.com");
            adGuard.setDnsRewrite("duckduckgo.com", "safe.duckduckgo.com");
        } else {
            adGuard.removeDnsRewrite("www.google.com", "forcesafesearch.google.com");
            adGuard.removeDnsRewrite("google.com", "forcesafesearch.google.com");
            adGuard.removeDnsRewrite("www.bing.com", "strict.bing.com");
            adGuard.removeDnsRewrite("duckduckgo.com", "safe.duckduckgo.com");
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
}
