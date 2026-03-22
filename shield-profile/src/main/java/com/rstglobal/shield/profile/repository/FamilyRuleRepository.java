package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.FamilyRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FamilyRuleRepository extends JpaRepository<FamilyRule, UUID> {

    List<FamilyRule> findByCustomerIdAndActiveTrueOrderBySortOrderAsc(UUID customerId);

    List<FamilyRule> findByCustomerIdOrderBySortOrderAsc(UUID customerId);
}
