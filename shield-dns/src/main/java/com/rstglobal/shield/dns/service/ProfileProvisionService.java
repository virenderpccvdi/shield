package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.dns.client.AdGuardClient;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileProvisionService {

    private final DnsRulesService rulesService;
    private final ScheduleService scheduleService;
    private final AdGuardClient adGuardClient;
    private final DnsRulesRepository rulesRepo;

    @Transactional
    public void provision(UUID tenantId, UUID profileId, String filterLevel, String dnsClientId, String profileName) {
        log.info("Provisioning DNS defaults for profileId={} filterLevel={} clientId={}", profileId, filterLevel, dnsClientId);
        DnsRules rules = rulesService.initRules(tenantId, profileId, filterLevel);
        if (dnsClientId != null && !dnsClientId.isBlank()) {
            rules.setDnsClientId(dnsClientId);
            rulesRepo.save(rules);
            // Create AdGuard client, then immediately sync current category rules
            // (createClient sets blocked_services=[] — syncRules pushes the real filter config)
            adGuardClient.createClient(dnsClientId, profileName != null ? profileName : dnsClientId, profileId.toString());
            rulesService.syncRules(profileId);
        }
        scheduleService.initSchedule(tenantId, profileId);
        // Refresh Vector enrichment CSV so new profile appears in analytics immediately
        refreshClientProfilesCsv();
    }

    /** Trigger async CSV refresh so Vector picks up the new profile within seconds. */
    private void refreshClientProfilesCsv() {
        try {
            new ProcessBuilder("/var/www/ai/FamilyShield/infra/vector/refresh_client_profiles.sh")
                    .redirectErrorStream(true)
                    .start(); // fire-and-forget
        } catch (Exception e) {
            log.warn("Could not trigger client_profiles.csv refresh: {}", e.getMessage());
        }
    }

    /** Backward-compatible overload without clientId */
    @Transactional
    public void provision(UUID tenantId, UUID profileId, String filterLevel) {
        provision(tenantId, profileId, filterLevel, null, null);
    }
}
