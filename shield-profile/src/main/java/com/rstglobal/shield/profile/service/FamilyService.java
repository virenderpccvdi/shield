package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.FamilyInviteRequest;
import com.rstglobal.shield.profile.dto.response.FamilyInviteResponse;
import com.rstglobal.shield.profile.dto.response.FamilyMemberResponse;
import com.rstglobal.shield.profile.entity.Customer;
import com.rstglobal.shield.profile.entity.FamilyInvite;
import com.rstglobal.shield.profile.entity.FamilyMember;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import com.rstglobal.shield.profile.repository.FamilyInviteRepository;
import com.rstglobal.shield.profile.repository.FamilyMemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FamilyService {

    private static final int INVITE_EXPIRY_DAYS = 7;
    private static final List<String> VALID_ROLES = List.of("GUARDIAN", "CO_PARENT", "OBSERVER");

    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyInviteRepository familyInviteRepository;
    private final CustomerRepository     customerRepository;

    /**
     * Get or create a family for the user. The familyId is the customer's ID
     * (i.e. the first GUARDIAN's customer row ID), ensuring one family per customer.
     */
    @Transactional
    public UUID getOrCreateFamily(UUID userId, UUID tenantId) {
        // Check if the user already belongs to a family
        return familyMemberRepository.findByUserId(userId)
                .map(FamilyMember::getFamilyId)
                .orElseGet(() -> {
                    // Create a new family with this user as GUARDIAN
                    Customer customer = customerRepository.findByUserId(userId)
                            .orElseThrow(() -> ShieldException.notFound("Customer", userId));
                    UUID familyId = customer.getId();

                    FamilyMember member = FamilyMember.builder()
                            .familyId(familyId)
                            .userId(userId)
                            .role("GUARDIAN")
                            .status("ACTIVE")
                            .build();
                    member.setTenantId(tenantId);
                    familyMemberRepository.save(member);

                    log.info("Created family {} for user {}", familyId, userId);
                    return familyId;
                });
    }

    /**
     * Send a co-parent invite to another email address.
     */
    @Transactional
    public FamilyInviteResponse invite(UUID userId, UUID tenantId, FamilyInviteRequest req) {
        UUID familyId = getOrCreateFamily(userId, tenantId);

        String role = (req.getRole() != null && VALID_ROLES.contains(req.getRole().toUpperCase()))
                ? req.getRole().toUpperCase()
                : "CO_PARENT";

        // Prevent duplicate pending invites
        if (familyInviteRepository.existsByEmailAndFamilyIdAndStatus(
                req.getEmail().toLowerCase(), familyId, "PENDING")) {
            throw ShieldException.conflict("An invite is already pending for this email");
        }

        // Prevent inviting existing members
        // (We can't check userId by email here since auth is a separate service,
        //  but we prevent self-invite if we know the user's customer record)

        String token = UUID.randomUUID().toString();

        FamilyInvite invite = FamilyInvite.builder()
                .familyId(familyId)
                .invitedBy(userId)
                .email(req.getEmail().toLowerCase())
                .role(role)
                .token(token)
                .status("PENDING")
                .expiresAt(Instant.now().plus(INVITE_EXPIRY_DAYS, ChronoUnit.DAYS))
                .build();
        invite.setTenantId(tenantId);

        invite = familyInviteRepository.save(invite);

        log.info("Family invite created: {} invited {} as {} to family {}",
                userId, req.getEmail(), role, familyId);

        // TODO: Send invite email via notification service (POST /api/v1/notifications/send)

        return toInviteResponse(invite);
    }

    /**
     * Accept a family invite using the token.
     */
    @Transactional
    public FamilyMemberResponse acceptInvite(UUID userId, UUID tenantId, String token) {
        FamilyInvite invite = familyInviteRepository.findByToken(token)
                .orElseThrow(() -> ShieldException.badRequest("Invalid invite token"));

        if (!"PENDING".equals(invite.getStatus())) {
            throw ShieldException.badRequest("Invite has already been " + invite.getStatus().toLowerCase());
        }

        if (Instant.now().isAfter(invite.getExpiresAt())) {
            invite.setStatus("EXPIRED");
            familyInviteRepository.save(invite);
            throw ShieldException.badRequest("Invite has expired");
        }

        // Check if already a member
        if (familyMemberRepository.existsByFamilyIdAndUserId(invite.getFamilyId(), userId)) {
            throw ShieldException.conflict("You are already a member of this family");
        }

        // Create member
        FamilyMember member = FamilyMember.builder()
                .familyId(invite.getFamilyId())
                .userId(userId)
                .role(invite.getRole())
                .invitedBy(invite.getInvitedBy())
                .status("ACTIVE")
                .build();
        member.setTenantId(tenantId);
        member = familyMemberRepository.save(member);

        // Mark invite as accepted
        invite.setStatus("ACCEPTED");
        familyInviteRepository.save(invite);

        log.info("User {} accepted family invite to family {} as {}", userId, invite.getFamilyId(), invite.getRole());

        return toMemberResponse(member);
    }

    /**
     * List all family members for the user's family.
     */
    public List<Object> listFamily(UUID userId, UUID tenantId) {
        UUID familyId = getOrCreateFamily(userId, tenantId);

        List<Object> result = new ArrayList<>();

        // Active members
        List<FamilyMemberResponse> members = familyMemberRepository.findByFamilyIdAndStatus(familyId, "ACTIVE")
                .stream().map(this::toMemberResponse).toList();
        result.addAll(members);

        // Pending invites
        List<FamilyInviteResponse> pendingInvites = familyInviteRepository
                .findByFamilyIdAndStatus(familyId, "PENDING")
                .stream()
                .filter(i -> Instant.now().isBefore(i.getExpiresAt()))
                .map(this::toInviteResponse)
                .toList();
        result.addAll(pendingInvites);

        return result;
    }

    /**
     * Update a family member's role (GUARDIAN only).
     */
    @Transactional
    public FamilyMemberResponse updateRole(UUID userId, UUID tenantId, UUID memberId, String newRole) {
        if (!VALID_ROLES.contains(newRole.toUpperCase())) {
            throw ShieldException.badRequest("Invalid role: " + newRole + ". Valid: " + VALID_ROLES);
        }

        UUID familyId = getOrCreateFamily(userId, tenantId);

        // Only GUARDIAN can change roles
        FamilyMember requester = familyMemberRepository.findByFamilyIdAndUserId(familyId, userId)
                .orElseThrow(() -> ShieldException.forbidden("Not a family member"));
        if (!"GUARDIAN".equals(requester.getRole())) {
            throw ShieldException.forbidden("Only GUARDIAN can change member roles");
        }

        FamilyMember target = familyMemberRepository.findById(memberId)
                .orElseThrow(() -> ShieldException.notFound("FamilyMember", memberId));

        if (!target.getFamilyId().equals(familyId)) {
            throw ShieldException.forbidden("Member not in your family");
        }

        target.setRole(newRole.toUpperCase());
        target = familyMemberRepository.save(target);

        log.info("User {} updated family member {} role to {}", userId, memberId, newRole);
        return toMemberResponse(target);
    }

    /**
     * Remove a family member (GUARDIAN only).
     */
    @Transactional
    public void removeMember(UUID userId, UUID tenantId, UUID memberId) {
        UUID familyId = getOrCreateFamily(userId, tenantId);

        FamilyMember requester = familyMemberRepository.findByFamilyIdAndUserId(familyId, userId)
                .orElseThrow(() -> ShieldException.forbidden("Not a family member"));
        if (!"GUARDIAN".equals(requester.getRole())) {
            throw ShieldException.forbidden("Only GUARDIAN can remove members");
        }

        FamilyMember target = familyMemberRepository.findById(memberId)
                .orElseThrow(() -> ShieldException.notFound("FamilyMember", memberId));

        if (!target.getFamilyId().equals(familyId)) {
            throw ShieldException.forbidden("Member not in your family");
        }

        if (target.getUserId().equals(userId)) {
            throw ShieldException.badRequest("Cannot remove yourself from the family");
        }

        target.setStatus("REMOVED");
        familyMemberRepository.save(target);

        log.info("User {} removed family member {}", userId, memberId);
    }

    // ── Mappers ─────────────────────────────────────────────────────────────

    private FamilyMemberResponse toMemberResponse(FamilyMember m) {
        return FamilyMemberResponse.builder()
                .id(m.getId())
                .familyId(m.getFamilyId())
                .userId(m.getUserId())
                .role(m.getRole())
                .invitedBy(m.getInvitedBy())
                .status(m.getStatus())
                .createdAt(m.getCreatedAt())
                .build();
    }

    private FamilyInviteResponse toInviteResponse(FamilyInvite i) {
        return FamilyInviteResponse.builder()
                .id(i.getId())
                .familyId(i.getFamilyId())
                .email(i.getEmail())
                .role(i.getRole())
                .status(i.getStatus())
                .expiresAt(i.getExpiresAt())
                .createdAt(i.getCreatedAt())
                .build();
    }
}
