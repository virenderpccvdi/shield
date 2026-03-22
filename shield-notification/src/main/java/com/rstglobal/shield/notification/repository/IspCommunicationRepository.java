package com.rstglobal.shield.notification.repository;

import com.rstglobal.shield.notification.entity.IspCommunication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface IspCommunicationRepository extends JpaRepository<IspCommunication, UUID> {
    Page<IspCommunication> findByTenantIdOrderBySentAtDesc(UUID tenantId, Pageable pageable);
}
