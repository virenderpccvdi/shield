package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.GlobalBlocklistEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GlobalBlocklistRepository extends JpaRepository<GlobalBlocklistEntry, UUID> {

    Optional<GlobalBlocklistEntry> findByDomain(String domain);

    boolean existsByDomain(String domain);

    List<GlobalBlocklistEntry> findByEmergencyTrue();

    Page<GlobalBlocklistEntry> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
