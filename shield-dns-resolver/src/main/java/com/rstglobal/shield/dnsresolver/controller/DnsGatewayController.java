package com.rstglobal.shield.dnsresolver.controller;

import com.rstglobal.shield.dnsresolver.service.DnsResolutionService;
import com.rstglobal.shield.dnsresolver.service.RulesCacheService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Shield DNS Gateway — receives DNS queries from the Shield Android VPN service.
 *
 * The Shield VPN on child devices intercepts all UDP port 53 traffic via a TUN
 * interface and forwards each query here as a raw DNS wire-format POST:
 *
 *   POST https://shield.rstglobal.in/dns/{dnsClientId}/dns-query
 *   Content-Type: application/dns-message
 *   Body: raw DNS wire-format packet
 *
 * This endpoint applies Shield's Java-based filtering rules (allowlist, blocklist,
 * categories, schedule, time budget) and either:
 *   - Returns 0.0.0.0 / :: for blocked domains, or
 *   - Forwards to upstream DNS (pure Java UDP via dnsjava) for allowed domains.
 *
 * The dnsClientId is extracted from the Host header
 * (format: {dnsClientId}.dns.shield.rstglobal.in) or from the URL path.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class DnsGatewayController {

    private static final MediaType DNS_MESSAGE = MediaType.parseMediaType("application/dns-message");
    private static final String DNS_HOST_SUFFIX = ".dns.shield.rstglobal.in";

    private final DnsResolutionService dnsResolutionService;
    private final RulesCacheService rulesCacheService;

    /**
     * Accept a raw DNS wire-format query, apply Shield filtering, return DNS response.
     */
    @PostMapping(
        path = "/dns-query",
        consumes = "application/dns-message",
        produces = "application/dns-message"
    )
    public Mono<ResponseEntity<byte[]>> dnsQuery(
            @RequestBody byte[] body,
            ServerWebExchange exchange) {

        String dnsClientId = extractDnsClientId(exchange);
        if (dnsClientId == null || dnsClientId.isEmpty()) {
            log.warn("No dnsClientId found in Host header: {}",
                exchange.getRequest().getHeaders().getFirst("Host"));
            dnsClientId = "unknown";
        }

        return dnsResolutionService.resolve(dnsClientId, body)
            .map(responseBytes -> ResponseEntity.ok()
                .contentType(DNS_MESSAGE)
                .header("Cache-Control", "max-age=60")
                .body(responseBytes));
    }

    /**
     * Health check.
     */
    @GetMapping("/dns-query")
    public Mono<ResponseEntity<String>> healthCheck() {
        return Mono.just(ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"status\":\"ok\",\"service\":\"shield-dns-resolver\"}"));
    }

    /**
     * Cache invalidation — called by shield-dns when rules change.
     */
    @PostMapping("/api/v1/dns-resolver/invalidate/{profileId}")
    public Mono<ResponseEntity<Void>> invalidateCache(@PathVariable String profileId) {
        log.info("Invalidating DNS cache for profileId={}", profileId);
        return rulesCacheService.invalidateProfile(profileId)
            .then(Mono.just(ResponseEntity.ok().<Void>build()));
    }

    /**
     * Extract dnsClientId from Host header.
     * Host format: {dnsClientId}.dns.shield.rstglobal.in
     */
    private String extractDnsClientId(ServerWebExchange exchange) {
        String host = exchange.getRequest().getHeaders().getFirst("Host");
        if (host == null) return null;

        int colonIdx = host.indexOf(':');
        if (colonIdx > 0) host = host.substring(0, colonIdx);

        if (host.endsWith(DNS_HOST_SUFFIX)) {
            return host.substring(0, host.length() - DNS_HOST_SUFFIX.length());
        }
        if (host.contains(".")) {
            return host.substring(0, host.indexOf('.'));
        }
        return host;
    }
}
