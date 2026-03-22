package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateFamilyRuleRequest;
import com.rstglobal.shield.profile.dto.request.UpdateFamilyRuleRequest;
import com.rstglobal.shield.profile.dto.response.FamilyRuleResponse;
import com.rstglobal.shield.profile.entity.FamilyRule;
import com.rstglobal.shield.profile.repository.FamilyRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FamilyRuleService {

    private final FamilyRuleRepository repo;

    @Transactional(readOnly = true)
    public List<FamilyRuleResponse> getRules(UUID customerId) {
        return repo.findByCustomerIdAndActiveTrueOrderBySortOrderAsc(customerId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<FamilyRuleResponse> getAllRules(UUID customerId) {
        return repo.findByCustomerIdOrderBySortOrderAsc(customerId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public FamilyRuleResponse createRule(UUID customerId, CreateFamilyRuleRequest req) {
        // Determine next sort order
        List<FamilyRule> existing = repo.findByCustomerIdOrderBySortOrderAsc(customerId);
        int nextOrder = existing.isEmpty() ? 0 : existing.get(existing.size() - 1).getSortOrder() + 1;

        FamilyRule rule = FamilyRule.builder()
                .customerId(customerId)
                .title(req.getTitle())
                .description(req.getDescription())
                .icon(req.getIcon() != null ? req.getIcon() : "rule")
                .active(true)
                .sortOrder(nextOrder)
                .build();
        return toResponse(repo.save(rule));
    }

    @Transactional
    public FamilyRuleResponse updateRule(UUID ruleId, UUID customerId, UpdateFamilyRuleRequest req) {
        FamilyRule rule = repo.findById(ruleId)
                .orElseThrow(() -> ShieldException.notFound("family-rule", ruleId.toString()));
        if (!rule.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Cannot modify a rule belonging to another customer");
        }
        if (req.getTitle() != null) rule.setTitle(req.getTitle());
        if (req.getDescription() != null) rule.setDescription(req.getDescription());
        if (req.getIcon() != null) rule.setIcon(req.getIcon());
        if (req.getActive() != null) rule.setActive(req.getActive());
        return toResponse(repo.save(rule));
    }

    @Transactional
    public void deleteRule(UUID ruleId, UUID customerId) {
        FamilyRule rule = repo.findById(ruleId)
                .orElseThrow(() -> ShieldException.notFound("family-rule", ruleId.toString()));
        if (!rule.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Cannot delete a rule belonging to another customer");
        }
        repo.delete(rule);
    }

    @Transactional
    public void reorder(UUID customerId, List<UUID> orderedIds) {
        for (int i = 0; i < orderedIds.size(); i++) {
            UUID ruleId = orderedIds.get(i);
            FamilyRule rule = repo.findById(ruleId)
                    .orElseThrow(() -> ShieldException.notFound("family-rule", ruleId.toString()));
            if (!rule.getCustomerId().equals(customerId)) {
                throw ShieldException.forbidden("Cannot reorder rules belonging to another customer");
            }
            rule.setSortOrder(i);
            repo.save(rule);
        }
    }

    private FamilyRuleResponse toResponse(FamilyRule r) {
        return FamilyRuleResponse.builder()
                .id(r.getId())
                .customerId(r.getCustomerId())
                .title(r.getTitle())
                .description(r.getDescription())
                .icon(r.getIcon())
                .active(r.getActive())
                .sortOrder(r.getSortOrder())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
