package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.DnsRules;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DnsRulesRepository extends JpaRepository<DnsRules, UUID> {
    Optional<DnsRules> findByProfileId(UUID profileId);
    boolean existsByProfileId(UUID profileId);
}
