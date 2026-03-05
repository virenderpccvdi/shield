package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.ExtensionRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExtensionRequestRepository extends JpaRepository<ExtensionRequest, UUID> {
    List<ExtensionRequest> findByCustomerIdAndStatusOrderByCreatedAtDesc(UUID customerId, String status);
    List<ExtensionRequest> findByProfileIdOrderByCreatedAtDesc(UUID profileId);
}
