package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.PlatformDefaults;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PlatformDefaultsRepository extends JpaRepository<PlatformDefaults, UUID> {
}
