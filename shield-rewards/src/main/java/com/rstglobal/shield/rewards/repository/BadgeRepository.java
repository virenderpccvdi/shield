package com.rstglobal.shield.rewards.repository;

import com.rstglobal.shield.rewards.entity.Badge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BadgeRepository extends JpaRepository<Badge, String> {
}
