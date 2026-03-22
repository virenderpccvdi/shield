package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.AppTimeBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppTimeBudgetRepository extends JpaRepository<AppTimeBudget, UUID> {
    List<AppTimeBudget> findByProfileId(UUID profileId);
    Optional<AppTimeBudget> findByProfileIdAndDomainPattern(UUID profileId, String domainPattern);
    void deleteByProfileIdAndId(UUID profileId, UUID id);
}
