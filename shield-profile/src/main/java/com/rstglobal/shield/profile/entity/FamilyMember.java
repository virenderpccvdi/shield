package com.rstglobal.shield.profile.entity;

import com.rstglobal.shield.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(schema = "profile", name = "family_members")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FamilyMember extends BaseEntity {

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "GUARDIAN";

    @Column(name = "invited_by")
    private UUID invitedBy;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";
}
