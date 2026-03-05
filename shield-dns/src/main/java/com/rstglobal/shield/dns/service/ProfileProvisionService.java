package com.rstglobal.shield.dns.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Called when a child profile is created in shield-profile.
 * Creates default DnsRules and Schedule records for the new profile.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileProvisionService {

    private final DnsRulesService rulesService;
    private final ScheduleService scheduleService;

    @Transactional
    public void provision(UUID tenantId, UUID profileId, String filterLevel) {
        log.info("Provisioning DNS defaults for profileId={} filterLevel={}", profileId, filterLevel);
        rulesService.initRules(tenantId, profileId, filterLevel);
        scheduleService.initSchedule(tenantId, profileId);
    }
}
