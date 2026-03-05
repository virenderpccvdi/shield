package com.rstglobal.shield.profile.entity;

import com.rstglobal.shield.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "profile", name = "family_invites")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FamilyInvite extends BaseEntity {

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "invited_by", nullable = false)
    private UUID invitedBy;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "CO_PARENT";

    @Column(nullable = false, unique = true, length = 255)
    private String token;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
