package com.rstglobal.shield.profile.repository;

import com.rstglobal.shield.profile.entity.FamilyInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FamilyInviteRepository extends JpaRepository<FamilyInvite, UUID> {

    Optional<FamilyInvite> findByToken(String token);

    List<FamilyInvite> findByFamilyIdAndStatus(UUID familyId, String status);

    boolean existsByEmailAndFamilyIdAndStatus(String email, UUID familyId, String status);
}
