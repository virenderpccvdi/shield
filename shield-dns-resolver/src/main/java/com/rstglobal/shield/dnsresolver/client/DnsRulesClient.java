package com.rstglobal.shield.dnsresolver.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

/**
 * Feign client for calling shield-dns service to load filtering rules on cache miss.
 */
@FeignClient(name = "shield-dns-direct", url = "${shield.dns.service.url:http://shield-dns:8284}", path = "/internal/dns")
public interface DnsRulesClient {

    /**
     * Get profile ID + tenant ID from dnsClientId.
     * Endpoint: GET /internal/dns/client/{dnsClientId}/profile
     */
    @GetMapping("/client/{dnsClientId}/profile")
    Map<String, Object> resolveClientId(@PathVariable("dnsClientId") String dnsClientId);

    /**
     * Get full DNS rules for a profile.
     * Endpoint: GET /internal/dns/rules/{profileId}
     */
    @GetMapping("/rules/{profileId}")
    Map<String, Object> getRulesForProfile(@PathVariable("profileId") String profileId);

    /**
     * Get all domain→category mappings from the master blocklist database.
     * Endpoint: GET /internal/dns/domain-blocklist
     * Returns list of {domain, categoryId} maps — used to populate Redis at startup.
     */
    @GetMapping("/domain-blocklist")
    List<Map<String, String>> getDomainBlocklist();
}
