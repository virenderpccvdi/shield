package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskRepository extends JpaRepository<Task, UUID> {

    List<Task> findByProfileId(UUID profileId);

    List<Task> findByProfileIdAndStatus(UUID profileId, String status);

    List<Task> findByProfileIdAndActive(UUID profileId, boolean active);
}
