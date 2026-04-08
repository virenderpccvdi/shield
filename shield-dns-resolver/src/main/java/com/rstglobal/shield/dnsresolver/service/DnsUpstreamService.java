package com.rstglobal.shield.dnsresolver.service;

import com.rstglobal.shield.dnsresolver.config.DnsProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import org.xbill.DNS.*;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.io.IOException;
import java.time.Duration;
import java.util.Base64;

/**
 * Forwards allowed DNS queries to upstream DNS servers using standard UDP — pure Java.
 *
 * Caches upstream DNS responses in Redis keyed by domain+type to avoid redundant
 * UDP round-trips under concurrent load. TTL is min(DNS response TTL, 300s).
 *
 * Uses dnsjava {@link SimpleResolver} (UDP port 53) to resolve queries that pass
 * Shield's filtering rules. No external HTTP/DoH dependencies: queries go directly
 * to the configured upstream IPs (default: Cloudflare 1.1.1.1, Google 8.8.8.8).
 *
 * Primary server is tried first. On failure, falls back to the secondary.
 * On total failure, returns a SERVFAIL response.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DnsUpstreamService {

    private static final String CACHE_PREFIX = "shield:dns:response:";
    private static final int    MAX_CACHE_TTL_SECONDS = 300;

    private final DnsProperties dnsProperties;
    private final ReactiveStringRedisTemplate redisTemplate;

    /**
     * Forward a raw DNS query packet to upstream DNS and return the response packet.
     * Checks Redis cache first; caches the response on cache miss.
     * Runs on bounded-elastic scheduler (blocking UDP I/O off the reactive thread).
     */
    public Mono<byte[]> forward(byte[] queryPacket) {
        String cacheKey = buildCacheKey(queryPacket);
        if (cacheKey == null) {
            // Cannot determine cache key (e.g. parse error) — go direct
            return forwardDirect(queryPacket);
        }
        return redisTemplate.opsForValue().get(cacheKey)
            .flatMap(cached -> {
                try {
                    log.debug("DNS cache HIT: {}", cacheKey);
                    // Rebuild response with original query ID so client correlates correctly
                    return Mono.just(rebuildWithQueryId(Base64.getDecoder().decode(cached), queryPacket));
                } catch (Exception e) {
                    return Mono.empty();
                }
            })
            .switchIfEmpty(
                forwardDirect(queryPacket)
                    .flatMap(response -> cacheResponse(cacheKey, response).thenReturn(response))
            );
    }

    private Mono<byte[]> forwardDirect(byte[] queryPacket) {
        return Mono.fromCallable(() -> forwardSync(queryPacket))
            .subscribeOn(Schedulers.boundedElastic())
            .timeout(Duration.ofMillis(dnsProperties.getQueryTimeoutMs() + 500))
            .onErrorResume(e -> {
                log.error("All upstream DNS resolvers failed: {}", e.getMessage());
                return Mono.just(buildServFail(queryPacket));
            });
    }

    /** Cache the response bytes in Redis with TTL = min(DNS TTL, 300s). */
    private Mono<Boolean> cacheResponse(String cacheKey, byte[] response) {
        try {
            int ttl = extractMinTtl(response);
            if (ttl <= 0) return Mono.just(false);
            String encoded = Base64.getEncoder().encodeToString(response);
            return redisTemplate.opsForValue()
                .set(cacheKey, encoded, Duration.ofSeconds(Math.min(ttl, MAX_CACHE_TTL_SECONDS)));
        } catch (Exception e) {
            return Mono.just(false);
        }
    }

    /** Build Redis key: shield:dns:response:{domain}:{type} */
    private String buildCacheKey(byte[] queryPacket) {
        try {
            Message query = new Message(queryPacket);
            org.xbill.DNS.Record q = query.getQuestion();
            if (q == null) return null;
            String domain = q.getName().toString(true).toLowerCase();
            String type   = Type.string(q.getType());
            return CACHE_PREFIX + domain + ":" + type;
        } catch (Exception e) {
            return null;
        }
    }

    /** Extract the minimum TTL from all answer/authority records in a response. */
    private int extractMinTtl(byte[] responsePacket) {
        try {
            Message resp = new Message(responsePacket);
            int min = MAX_CACHE_TTL_SECONDS;
            for (int section : new int[]{Section.ANSWER, Section.AUTHORITY}) {
                for (org.xbill.DNS.Record r : resp.getSection(section)) {
                    if (r.getTTL() > 0) min = (int) Math.min(min, r.getTTL());
                }
            }
            return min;
        } catch (Exception e) {
            return MAX_CACHE_TTL_SECONDS;
        }
    }

    /** Rebuild a cached response with the current query's transaction ID. */
    private byte[] rebuildWithQueryId(byte[] cached, byte[] originalQuery) {
        try {
            Message resp  = new Message(cached);
            Message query = new Message(originalQuery);
            resp.getHeader().setID(query.getHeader().getID());
            return resp.toWire();
        } catch (Exception e) {
            return cached;
        }
    }

    private byte[] forwardSync(byte[] queryPacket) throws Exception {
        Exception lastException = null;
        String[] upstreams = {dnsProperties.getUpstreamDns(), dnsProperties.getUpstreamFallbackDns()};
        for (String serverIp : upstreams) {
            try {
                return forwardTo(serverIp, queryPacket);
            } catch (Exception e) {
                log.warn("DNS upstream {} failed: {}", serverIp, e.getMessage());
                lastException = e;
            }
        }
        throw (lastException != null) ? lastException : new IOException("All upstream DNS servers failed");
    }

    /**
     * Send a single DNS query to the given IP via UDP using dnsjava SimpleResolver.
     */
    private byte[] forwardTo(String serverIp, byte[] queryPacket) throws Exception {
        SimpleResolver resolver = new SimpleResolver(serverIp);
        resolver.setTimeout(Duration.ofMillis(dnsProperties.getQueryTimeoutMs()));
        Message query = new Message(queryPacket);
        Message response = resolver.send(query);
        return response.toWire();
    }

    /**
     * Build a SERVFAIL response for the given query packet.
     */
    public static byte[] buildServFail(byte[] queryPacket) {
        try {
            Message query = new Message(queryPacket);
            Message response = new Message(query.getHeader().getID());
            response.getHeader().setFlag(Flags.QR);
            response.getHeader().setRcode(Rcode.SERVFAIL);
            if (query.getQuestion() != null) {
                response.addRecord(query.getQuestion(), Section.QUESTION);
            }
            return response.toWire();
        } catch (IOException e) {
            log.error("Failed to build SERVFAIL response", e);
            // Minimal 12-byte SERVFAIL
            return new byte[]{0, 0, (byte) 0x80, 2, 0, 0, 0, 0, 0, 0, 0, 0};
        }
    }
}
