package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.CrmActivity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CrmActivityRepository extends JpaRepository<CrmActivity, UUID> {
    List<CrmActivity> findByLeadIdOrderByPerformedAtDesc(UUID leadId);
    long countByLeadId(UUID leadId);
}
