package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.ContactSubmitRequest;
import com.rstglobal.shield.admin.dto.LeadUpdateRequest;
import com.rstglobal.shield.admin.entity.ContactLead;
import com.rstglobal.shield.admin.repository.ContactLeadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContactLeadService {

    private final ContactLeadRepository repo;

    public ContactLead submit(ContactSubmitRequest req, String ip, String userAgent) {
        ContactLead lead = ContactLead.builder()
                .name(req.getName())
                .email(req.getEmail())
                .phone(req.getPhone())
                .company(req.getCompany())
                .message(req.getMessage())
                .source(req.getSource() != null ? req.getSource() : "website")
                .status("NEW")
                .ipAddress(ip)
                .userAgent(userAgent)
                .build();
        return repo.save(lead);
    }

    public Page<ContactLead> list(String status, Pageable pageable) {
        if (status != null) {
            return repo.findAll(
                (root, q, cb) -> cb.equal(root.get("status"), status),
                pageable
            );
        }
        return repo.findAll(pageable);
    }

    public ContactLead get(UUID id) {
        return repo.findById(id).orElseThrow(() -> new RuntimeException("Lead not found: " + id));
    }

    public ContactLead update(UUID id, LeadUpdateRequest req) {
        ContactLead lead = get(id);
        if (req.getStatus() != null) lead.setStatus(req.getStatus());
        if (req.getNotes() != null) lead.setNotes(req.getNotes());
        if (req.getAssignedTo() != null) lead.setAssignedTo(req.getAssignedTo());
        return repo.save(lead);
    }

    public void delete(UUID id) {
        repo.deleteById(id);
    }

    public Map<String, Long> stats() {
        return Map.of(
            "total", repo.count(),
            "new", repo.countByStatus("NEW"),
            "contacted", repo.countByStatus("CONTACTED"),
            "qualified", repo.countByStatus("QUALIFIED"),
            "closed", repo.countByStatus("CLOSED")
        );
    }
}
