package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.repository.SubscriptionPlanRepository;
import com.rstglobal.shield.common.exception.ShieldException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SubscriptionPlanService {

    private final SubscriptionPlanRepository repo;

    public List<SubscriptionPlan> listActive() {
        return repo.findByActiveTrueOrderBySortOrder();
    }

    public List<SubscriptionPlan> listAll() {
        return repo.findAll();
    }

    public SubscriptionPlan getById(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> ShieldException.notFound("SubscriptionPlan", id));
    }

    @Transactional
    public SubscriptionPlan create(SubscriptionPlan plan) {
        repo.findByName(plan.getName()).ifPresent(existing -> {
            throw ShieldException.conflict("Plan with name '" + plan.getName() + "' already exists");
        });
        return repo.save(plan);
    }

    @Transactional
    public SubscriptionPlan update(UUID id, SubscriptionPlan updated) {
        SubscriptionPlan existing = getById(id);
        existing.setDisplayName(updated.getDisplayName());
        existing.setPrice(updated.getPrice());
        existing.setBillingCycle(updated.getBillingCycle());
        existing.setMaxCustomers(updated.getMaxCustomers());
        existing.setMaxProfilesPerCustomer(updated.getMaxProfilesPerCustomer());
        existing.setFeatures(updated.getFeatures());
        existing.setDescription(updated.getDescription());
        existing.setSortOrder(updated.getSortOrder());
        existing.setActive(updated.getActive());
        return repo.save(existing);
    }

    @Transactional
    public void delete(UUID id) {
        SubscriptionPlan plan = getById(id);
        if (Boolean.TRUE.equals(plan.getIsDefault())) {
            throw new ShieldException("CANNOT_DELETE_DEFAULT", "Cannot delete a default plan", HttpStatus.BAD_REQUEST);
        }
        repo.delete(plan);
    }
}
