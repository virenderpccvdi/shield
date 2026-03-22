package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.FamilyMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FamilyMemberRepository extends JpaRepository<FamilyMember, UUID> {

    List<FamilyMember> findByFamilyIdAndStatus(UUID familyId, String status);

    List<FamilyMember> findByFamilyId(UUID familyId);

    Optional<FamilyMember> findByFamilyIdAndUserId(UUID familyId, UUID userId);

    Optional<FamilyMember> findByUserId(UUID userId);

    boolean existsByFamilyIdAndUserId(UUID familyId, UUID userId);

    /** Returns all active family memberships for a given user (co-parent or guardian). */
    List<FamilyMember> findByUserIdAndStatus(UUID userId, String status);
}
