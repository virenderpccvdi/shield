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
 * DNS-over-HTTPS endpoint.
 *
 * The Flutter VPN on child devices sends DNS queries as:
 *   POST https://{dnsClientId}.dns.shield.rstglobal.in/dns-query
 *   Content-Type: application/dns-message
 *   Body: raw DNS wire-format packet
 *
 * The dnsClientId is extracted from the Host header.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class DohController {

    private static final MediaType DNS_MESSAGE = MediaType.parseMediaType("application/dns-message");
    private static final String DNS_HOST_SUFFIX = ".dns.shield.rstglobal.in";

    private final DnsResolutionService dnsResolutionService;
    private final RulesCacheService rulesCacheService;

    /**
     * Handle DoH POST requests (RFC 8484).
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
            // Still resolve — forward without filtering
            dnsClientId = "unknown";
        }

        return dnsResolutionService.resolve(dnsClientId, body)
            .map(responseBytes -> ResponseEntity.ok()
                .contentType(DNS_MESSAGE)
                .header("Cache-Control", "max-age=60")
                .body(responseBytes));
    }

    /**
     * Health check for the DoH endpoint.
     */
    @GetMapping("/dns-query")
    public Mono<ResponseEntity<String>> healthCheck() {
        return Mono.just(ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"status\":\"ok\",\"service\":\"shield-dns-resolver\",\"protocol\":\"DoH RFC 8484\"}"));
    }

    /**
     * Cache invalidation endpoint — called by shield-dns when rules change.
     */
    @PostMapping("/api/v1/dns-resolver/invalidate/{profileId}")
    public Mono<ResponseEntity<Void>> invalidateCache(@PathVariable String profileId) {
        log.info("Invalidating DNS cache for profileId={}", profileId);
        return rulesCacheService.invalidateProfile(profileId)
            .then(Mono.just(ResponseEntity.ok().build()));
    }

    /**
     * Extract dnsClientId from Host header.
     * Host format: {dnsClientId}.dns.shield.rstglobal.in
     */
    private String extractDnsClientId(ServerWebExchange exchange) {
        String host = exchange.getRequest().getHeaders().getFirst("Host");
        if (host == null) return null;

        // Remove port if present
        int colonIdx = host.indexOf(':');
        if (colonIdx > 0) host = host.substring(0, colonIdx);

        if (host.endsWith(DNS_HOST_SUFFIX)) {
            return host.substring(0, host.length() - DNS_HOST_SUFFIX.length());
        }

        // Also handle just the subdomain part for local testing
        if (host.contains(".")) {
            return host.substring(0, host.indexOf('.'));
        }

        return host;
    }
}
