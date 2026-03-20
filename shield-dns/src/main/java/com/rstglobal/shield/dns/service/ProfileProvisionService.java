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
            adGuardClient.createClient(dnsClientId, profileName != null ? profileName : dnsClientId, profileId.toString());
        }
        scheduleService.initSchedule(tenantId, profileId);
    }

    /** Backward-compatible overload without clientId */
    @Transactional
    public void provision(UUID tenantId, UUID profileId, String filterLevel) {
        provision(tenantId, profileId, filterLevel, null, null);
    }
}
