package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.model.BlockDecision;
import com.rstglobal.shield.dnsresolver.model.DnsQueryLogEntry;
import com.rstglobal.shield.dnsresolver.model.DomainInfo;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import org.xbill.DNS.*;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.time.Instant;

/**
 * Core DNS resolution logic:
 * 1. Parse DNS query (dnsjava)
 * 2. Extract domain name
 * 3. Enrich domain (app name, category)
 * 4. Check rules (allowlist → blocklist → category → schedule)
 * 5. Block (return 0.0.0.0) or forward to upstream DNS (pure Java UDP)
 * 6. Log query asynchronously
 */
@Slf4j
@Service
public class DnsResolutionService {

    private final RulesCacheService rulesCacheService;
    private final DnsUpstreamService dnsUpstreamService;
    private final DomainEnrichmentService domainEnrichmentService;
    private final DnsQueryLogService dnsQueryLogService;
    private final ReactiveStringRedisTemplate redisTemplate;
    private final Counter queriesTotal;
    private final Counter queriesBlocked;
    private final Counter queriesForwarded;
    private final Timer queryTimer;

    public DnsResolutionService(RulesCacheService rulesCacheService,
                                 DnsUpstreamService dnsUpstreamService,
                                 DomainEnrichmentService domainEnrichmentService,
                                 DnsQueryLogService dnsQueryLogService,
                                 ReactiveStringRedisTemplate redisTemplate,
                                 MeterRegistry meterRegistry) {
        this.rulesCacheService = rulesCacheService;
        this.dnsUpstreamService = dnsUpstreamService;
        this.domainEnrichmentService = domainEnrichmentService;
        this.dnsQueryLogService = dnsQueryLogService;
        this.redisTemplate = redisTemplate;

        this.queriesTotal = Counter.builder("dns.queries.total")
            .description("Total DNS queries processed")
            .register(meterRegistry);
        this.queriesBlocked = Counter.builder("dns.queries.blocked")
            .description("DNS queries blocked by rules")
            .register(meterRegistry);
        this.queriesForwarded = Counter.builder("dns.queries.forwarded")
            .description("DNS queries forwarded upstream")
            .register(meterRegistry);
        this.queryTimer = Timer.builder("dns.query.duration")
            .description("DNS query processing duration")
            .register(meterRegistry);
    }

    /**
     * Resolve a DNS query for the given dnsClientId.
     *
     * @param dnsClientId the client identifier from the Host header
     * @param queryPacket the raw DNS wire-format query
     * @return the raw DNS wire-format response
     */
    public Mono<byte[]> resolve(String dnsClientId, byte[] queryPacket) {
        long startTime = System.currentTimeMillis();
        queriesTotal.increment();

        // Parse DNS query
        Message query;
        try {
            query = new Message(queryPacket);
        } catch (IOException e) {
            log.error("Failed to parse DNS query: {}", e.getMessage());
            return Mono.just(DnsUpstreamService.buildServFail(queryPacket));
        }

        org.xbill.DNS.Record question = query.getQuestion();
        if (question == null) {
            return dnsUpstreamService.forward(queryPacket);
        }

        String domain = question.getName().toString(true); // omit trailing dot
        int queryType = question.getType();
        String queryTypeName = Type.string(queryType);

        // Only filter A and AAAA queries; pass through others (MX, TXT, SRV, etc.)
        if (queryType != Type.A && queryType != Type.AAAA) {
            return dnsUpstreamService.forward(queryPacket);
        }

        // Enrich domain — check Redis domain-category cache first, then in-memory fallback
        return domainEnrichmentService.enrichAsync(domain, redisTemplate)
            .flatMap(info ->

        // Resolve profile and check rules
        rulesCacheService.getProfileId(dnsClientId)
            .flatMap(profileId ->
                // Ensure rules are cached
                rulesCacheService.loadRulesIfMissing(profileId)
                    .then(rulesCacheService.check(profileId, info.getRootDomain(), info.getOriginalDomain(), info.getCategory()))
                    .flatMap(decision -> {
                        long latencyMs = System.currentTimeMillis() - startTime;

                        if (decision.isBlocked()) {
                            queriesBlocked.increment();
                            logQueryAsync(profileId, dnsClientId, info, queryTypeName, decision, latencyMs);
                            return Mono.just(buildBlockResponse(query, queryType));
                        }

                        // Forward to upstream
                        queriesForwarded.increment();
                        return dnsUpstreamService.forward(queryPacket)
                            .doOnNext(resp -> {
                                long totalLatency = System.currentTimeMillis() - startTime;
                                queryTimer.record(java.time.Duration.ofMillis(totalLatency));
                                logQueryAsync(profileId, dnsClientId, info, queryTypeName, decision, totalLatency);
                            });
                    })
            )
            .switchIfEmpty(
                // No profile found — forward without filtering (unknown client)
                dnsUpstreamService.forward(queryPacket)
                    .doOnNext(resp -> {
                        long latencyMs = System.currentTimeMillis() - startTime;
                        queryTimer.record(java.time.Duration.ofMillis(latencyMs));
                        log.debug("Unknown dnsClientId={}, forwarded domain={}", dnsClientId, domain);
                    })
            )
            .onErrorResume(e -> {
                log.error("Error resolving query for domain={}: {}", domain, e.getMessage());
                return dnsUpstreamService.forward(queryPacket);
            })
        ) // close enrichAsync flatMap
        .onErrorResume(e -> {
            log.error("Domain enrichment error for domain={}: {}", domain, e.getMessage());
            return dnsUpstreamService.forward(queryPacket);
        });
    }

    /**
     * Build a block response: return 0.0.0.0 for A queries, :: for AAAA queries.
     */
    private byte[] buildBlockResponse(Message query, int queryType) {
        try {
            Message response = new Message(query.getHeader().getID());
            response.getHeader().setFlag(Flags.QR);
            response.getHeader().setFlag(Flags.AA);
            response.getHeader().setRcode(Rcode.NOERROR);
            response.addRecord(query.getQuestion(), Section.QUESTION);

            Name name = query.getQuestion().getName();
            if (queryType == Type.A) {
                response.addRecord(new ARecord(name, DClass.IN, 60,
                    java.net.InetAddress.getByName("0.0.0.0")), Section.ANSWER);
            } else if (queryType == Type.AAAA) {
                response.addRecord(new AAAARecord(name, DClass.IN, 60,
                    java.net.InetAddress.getByName("::")), Section.ANSWER);
            }

            return response.toWire();
        } catch (Exception e) {
            log.error("Failed to build block response", e);
            return DnsUpstreamService.buildServFail(query.toWire());
        }
    }

    private void logQueryAsync(String profileId, String dnsClientId, DomainInfo info,
                                String queryType, BlockDecision decision, long latencyMs) {
        DnsQueryLogEntry entry = DnsQueryLogEntry.builder()
            .profileId(profileId)
            .dnsClientId(dnsClientId)
            .domain(info.getOriginalDomain())
            .rootDomain(info.getRootDomain())
            .appName(info.getAppName())
            .category(info.getCategory())
            .queryType(queryType)
            .blocked(decision.isBlocked())
            .blockReason(decision.getReason())
            .latencyMs(latencyMs)
            .timestamp(Instant.now())
            .build();

        dnsQueryLogService.logQuery(entry);
    }
}
