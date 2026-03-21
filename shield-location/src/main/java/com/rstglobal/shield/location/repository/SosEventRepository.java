package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.SosEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SosEventRepository extends JpaRepository<SosEvent, UUID> {

    List<SosEvent> findTop50ByProfileIdAndStatusOrderByTriggeredAtDesc(UUID profileId, String status);

    List<SosEvent> findTop50ByProfileIdOrderByTriggeredAtDesc(UUID profileId);

    List<SosEvent> findTop50ByStatusOrderByTriggeredAtDesc(String status);

    List<SosEvent> findTop50ByOrderByTriggeredAtDesc();
}
