package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.client.DnsRulesClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;

/**
 * Loads the master domain → category blocklist from shield-dns into Redis at startup
 * and refreshes every 6 hours.
 *
 * Redis key pattern: shield:domcat:{domain} → categoryId
 * e.g. shield:domcat:tiktokcdn.com → "16"   (category 16 = TikTok)
 *      shield:domcat:rbxcdn.com    → "18"   (category 18 = Online Gaming)
 *
 * DomainEnrichmentService checks this cache FIRST on every DNS query,
 * then falls back to the in-memory CATEGORY_MAP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryCacheLoader {

    static final String DOMCAT_PREFIX = "shield:domcat:";

    private final ReactiveStringRedisTemplate redis;
    private final DnsRulesClient dnsRulesClient;

    private volatile int lastLoadedCount = 0;

    @PostConstruct
    public void loadOnStartup() {
        // Run async so startup is not blocked; retry if shield-dns not ready yet
        Mono.fromRunnable(this::loadAll)
            .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
            .subscribe();
    }

    /**
     * Refresh domain→category Redis cache every 6 hours.
     */
    @Scheduled(fixedRateString = "${dns.domain-cache.refresh-ms:21600000}")
    public void scheduledRefresh() {
        log.debug("CategoryCacheLoader scheduled refresh triggered");
        loadAll();
    }

    /**
     * Pull all domain entries from shield-dns and write them into Redis.
     * Uses reactive pipeline for efficiency (single round-trip for N entries).
     */
    void loadAll() {
        try {
            List<Map<String, String>> entries = dnsRulesClient.getDomainBlocklist();
            if (entries == null || entries.isEmpty()) {
                log.warn("CategoryCacheLoader: domain-blocklist returned empty — using in-memory fallback only");
                return;
            }

            // Build map of domain → categoryId for bulk set
            Map<String, String> domcatMap = new java.util.HashMap<>();
            for (Map<String, String> entry : entries) {
                String domain = entry.get("domain");
                // API now returns categoryKey (e.g. "adult", "gambling") — fallback to categoryId for compat
                String categoryKey = entry.getOrDefault("categoryKey", entry.get("categoryId"));
                if (domain != null && categoryKey != null) {
                    domcatMap.put(DOMCAT_PREFIX + domain.toLowerCase(), categoryKey);
                }
            }

            if (domcatMap.isEmpty()) return;

            redis.opsForValue().multiSet(domcatMap)
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .doOnSuccess(v -> {
                    lastLoadedCount = domcatMap.size();
                    log.info("CategoryCacheLoader: loaded {} domain→category mappings into Redis", lastLoadedCount);
                })
                .doOnError(e -> log.warn("CategoryCacheLoader: Redis write failed — {}", e.getMessage()))
                .subscribe();

        } catch (Exception e) {
            log.warn("CategoryCacheLoader: failed to fetch domain-blocklist from shield-dns: {} " +
                     "(in-memory category map will be used as fallback)", e.getMessage());
        }
    }

    /**
     * Add or update a single domain→category entry in Redis.
     * Called when admin adds a new domain to the master blocklist.
     */
    public Mono<Void> refreshDomain(String domain, String categoryId) {
        String key = DOMCAT_PREFIX + domain.toLowerCase();
        return redis.opsForValue().set(key, categoryId).then();
    }

    /**
     * Remove a domain from the Redis cache.
     */
    public Mono<Void> evictDomain(String domain) {
        return redis.delete(DOMCAT_PREFIX + domain.toLowerCase()).then();
    }

    public int getLastLoadedCount() {
        return lastLoadedCount;
    }
}
