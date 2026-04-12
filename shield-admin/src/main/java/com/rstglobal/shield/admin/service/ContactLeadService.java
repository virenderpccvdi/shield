package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.ActivityRequest;
import com.rstglobal.shield.admin.dto.ContactSubmitRequest;
import com.rstglobal.shield.admin.dto.LeadUpdateRequest;
import com.rstglobal.shield.admin.entity.ContactLead;
import com.rstglobal.shield.admin.entity.CrmActivity;
import com.rstglobal.shield.admin.repository.ContactLeadRepository;
import com.rstglobal.shield.admin.repository.CrmActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContactLeadService {

    private final ContactLeadRepository repo;
    private final CrmActivityRepository activityRepo;

    @Transactional
    public ContactLead submit(ContactSubmitRequest req, String ip, String userAgent) {
        ContactLead lead = ContactLead.builder()
                .name(req.getName())
                .email(req.getEmail())
                .phone(req.getPhone())
                .company(req.getCompany())
                .message(req.getMessage())
                .source(req.getSource() != null ? req.getSource() : "website")
                .status("NEW")
                .pipelineStage("NEW")
                .ipAddress(ip)
                .userAgent(userAgent)
                .build();
        ContactLead saved = repo.save(lead);

        // Auto-create first activity
        activityRepo.save(CrmActivity.builder()
                .leadId(saved.getId())
                .type("NOTE")
                .title("Lead created from " + saved.getSource())
                .description("New lead submitted by " + saved.getName() + " <" + saved.getEmail() + ">")
                .performedAt(OffsetDateTime.now())
                .build());

        return saved;
    }

    @Transactional(readOnly = true)
    public Page<ContactLead> list(String status, String stage, Pageable pageable) {
        if (stage != null && !stage.isBlank()) {
            return repo.findAll(
                (root, q, cb) -> cb.equal(root.get("pipelineStage"), stage),
                pageable
            );
        }
        if (status != null && !status.isBlank()) {
            return repo.findAll(
                (root, q, cb) -> cb.equal(root.get("status"), status),
                pageable
            );
        }
        return repo.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public ContactLead get(UUID id) {
        return repo.findById(id).orElseThrow(() -> new RuntimeException("Lead not found: " + id));
    }

    @Transactional
    public ContactLead update(UUID id, LeadUpdateRequest req) {
        ContactLead lead = get(id);
        if (req.getStatus() != null)         lead.setStatus(req.getStatus());
        if (req.getPipelineStage() != null)  lead.setPipelineStage(req.getPipelineStage());
        if (req.getNotes() != null)          lead.setNotes(req.getNotes());
        if (req.getAssignedTo() != null)     lead.setAssignedTo(req.getAssignedTo());
        if (req.getAssignedToName() != null) lead.setAssignedToName(req.getAssignedToName());
        if (req.getDealValue() != null)      lead.setDealValue(req.getDealValue());
        if (req.getFollowUpAt() != null)     lead.setFollowUpAt(req.getFollowUpAt());
        if (req.getTags() != null)           lead.setTags(req.getTags());
        if (req.getLostReason() != null)     lead.setLostReason(req.getLostReason());
        return repo.save(lead);
    }

    @Transactional
    public void delete(UUID id) {
        repo.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> stats() {
        return Map.of(
            "total",     repo.count(),
            "new",       repo.countByStatus("NEW"),
            "contacted", repo.countByStatus("CONTACTED"),
            "qualified", repo.countByStatus("QUALIFIED"),
            "proposal",  repo.countByPipelineStage("PROPOSAL"),
            "won",       repo.countByPipelineStage("WON"),
            "lost",      repo.countByPipelineStage("LOST")
        );
    }

    // ── Activities ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CrmActivity> getActivities(UUID leadId) {
        return activityRepo.findByLeadIdOrderByPerformedAtDesc(leadId);
    }

    @Transactional
    public CrmActivity addActivity(UUID leadId, ActivityRequest req, UUID userId, String userName) {
        get(leadId); // verify lead exists
        CrmActivity act = CrmActivity.builder()
                .leadId(leadId)
                .type(req.getType() != null ? req.getType() : "NOTE")
                .title(req.getTitle())
                .description(req.getDescription())
                .outcome(req.getOutcome())
                .performedBy(userId)
                .performedByName(userName != null ? userName : req.getPerformedByName())
                .performedAt(req.getPerformedAt() != null ? req.getPerformedAt() : OffsetDateTime.now())
                .build();
        return activityRepo.save(act);
    }

    @Transactional
    public void deleteActivity(UUID actId) {
        activityRepo.deleteById(actId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> pipeline() {
        List<ContactLead> all = repo.findAll();
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String stage : List.of("NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST")) {
            final String s = stage;
            counts.put(stage, all.stream().filter(l -> s.equals(l.getPipelineStage())).count());
        }
        BigDecimal totalValue = all.stream()
                .filter(l -> "WON".equals(l.getPipelineStage()) && l.getDealValue() != null)
                .map(ContactLead::getDealValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("stages", counts, "wonValue", totalValue);
    }
}
