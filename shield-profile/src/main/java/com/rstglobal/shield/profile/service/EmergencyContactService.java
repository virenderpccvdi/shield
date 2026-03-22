package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.EmergencyContactRequest;
import com.rstglobal.shield.profile.dto.response.EmergencyContactResponse;
import com.rstglobal.shield.profile.entity.EmergencyContact;
import com.rstglobal.shield.profile.repository.EmergencyContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmergencyContactService {

    private final EmergencyContactRepository repo;
    private static final int MAX_CONTACTS = 3;

    @Transactional
    public EmergencyContactResponse add(UUID profileId, EmergencyContactRequest req) {
        if (req.getPhone() == null && req.getEmail() == null) {
            throw ShieldException.badRequest("At least phone or email is required");
        }
        if (repo.countByProfileId(profileId) >= MAX_CONTACTS) {
            throw ShieldException.conflict("Maximum " + MAX_CONTACTS + " emergency contacts allowed");
        }
        EmergencyContact entity = EmergencyContact.builder()
                .profileId(profileId)
                .name(req.getName())
                .phone(req.getPhone())
                .email(req.getEmail())
                .relationship(req.getRelationship())
                .build();
        return toResponse(repo.save(entity));
    }

    @Transactional(readOnly = true)
    public List<EmergencyContactResponse> getAll(UUID profileId) {
        return repo.findByProfileIdOrderByCreatedAtAsc(profileId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public void delete(UUID profileId, UUID contactId) {
        EmergencyContact c = repo.findById(contactId)
                .orElseThrow(() -> ShieldException.notFound("emergency-contact", contactId.toString()));
        if (!c.getProfileId().equals(profileId)) {
            throw ShieldException.forbidden("Cannot delete contact for another profile");
        }
        repo.delete(c);
    }

    private EmergencyContactResponse toResponse(EmergencyContact e) {
        return EmergencyContactResponse.builder()
                .id(e.getId())
                .profileId(e.getProfileId())
                .name(e.getName())
                .phone(e.getPhone())
                .email(e.getEmail())
                .relationship(e.getRelationship())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
