package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.ContactLead;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface ContactLeadRepository extends JpaRepository<ContactLead, UUID>, JpaSpecificationExecutor<ContactLead> {

    @Query("SELECT COUNT(l) FROM ContactLead l WHERE l.status = :status")
    long countByStatus(String status);

    @Query("SELECT COUNT(l) FROM ContactLead l WHERE l.pipelineStage = :stage")
    long countByPipelineStage(String stage);
}
