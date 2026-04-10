package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.response.PublicPlanResponse;
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

    /** All active plans (Global Admin view) */
    public List<SubscriptionPlan> listActive() {
        return repo.findByActiveTrueOrderBySortOrder();
    }

    /** All plans (Global Admin view) */
    public List<SubscriptionPlan> listAll() {
        return repo.findAll();
    }

    /** ISP-level plans (platform plans that ISPs subscribe to) */
    public List<SubscriptionPlan> listIspPlans() {
        return repo.findByPlanTypeAndActiveTrueOrderBySortOrder("ISP");
    }

    /** Public-facing ISP plan list — no auth required — for marketing pages. */
    public List<PublicPlanResponse> getPublicPlans() {
        return repo.findByPlanTypeAndActiveTrueOrderBySortOrder("ISP").stream()
                .map(p -> PublicPlanResponse.builder()
                        .id(p.getId())
                        .name(p.getName())
                        .displayName(p.getDisplayName())
                        .price(p.getPrice())
                        .billingCycle(p.getBillingCycle())
                        .description(p.getDescription())
                        .features(p.getFeatures())
                        .maxProfilesPerCustomer(p.getMaxProfilesPerCustomer())
                        .sortOrder(p.getSortOrder())
                        .build())
                .toList();
    }

    /** Customer plans created by a specific ISP tenant */
    public List<SubscriptionPlan> listByTenant(UUID tenantId) {
        return repo.findByTenantIdAndActiveTrueOrderBySortOrder(tenantId);
    }

    /** All customer plans for a tenant (including inactive) */
    public List<SubscriptionPlan> listAllByTenant(UUID tenantId) {
        return repo.findByTenantIdOrderBySortOrder(tenantId);
    }

    public SubscriptionPlan getById(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> ShieldException.notFound("SubscriptionPlan", id));
    }

    @Transactional
    public SubscriptionPlan create(SubscriptionPlan plan) {
        if (plan.getMaxCustomers() == null)          plan.setMaxCustomers(100);
        if (plan.getMaxProfilesPerCustomer() == null) plan.setMaxProfilesPerCustomer(5);
        if (plan.getIsDefault() == null)              plan.setIsDefault(false);
        if (plan.getActive() == null)                 plan.setActive(true);
        if (plan.getSortOrder() == null)              plan.setSortOrder(0);
        if (plan.getBillingCycle() == null)           plan.setBillingCycle("MONTHLY");
        if (plan.getPlanType() == null)               plan.setPlanType("ISP");
        return repo.save(plan);
    }

    @Transactional
    public SubscriptionPlan createForTenant(UUID tenantId, SubscriptionPlan plan) {
        plan.setTenantId(tenantId);
        plan.setPlanType("CUSTOMER");
        // Apply defaults that @Builder.Default doesn't cover for Jackson-deserialized objects
        if (plan.getMaxCustomers() == null)          plan.setMaxCustomers(0);   // 0 = unlimited for customer plans
        if (plan.getMaxProfilesPerCustomer() == null) plan.setMaxProfilesPerCustomer(5);
        if (plan.getIsDefault() == null)              plan.setIsDefault(false);
        if (plan.getActive() == null)                 plan.setActive(true);
        if (plan.getSortOrder() == null)              plan.setSortOrder(0);
        if (plan.getBillingCycle() == null)           plan.setBillingCycle("MONTHLY");
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
        if (updated.getSortOrder() != null) existing.setSortOrder(updated.getSortOrder());
        existing.setActive(updated.getActive());
        return repo.save(existing);
    }

    @Transactional
    public SubscriptionPlan updateForTenant(UUID id, UUID tenantId, SubscriptionPlan updated) {
        SubscriptionPlan existing = getById(id);
        // Verify plan belongs to this tenant
        if (!tenantId.equals(existing.getTenantId())) {
            throw ShieldException.forbidden("Plan does not belong to your tenant");
        }
        existing.setDisplayName(updated.getDisplayName());
        existing.setPrice(updated.getPrice());
        existing.setBillingCycle(updated.getBillingCycle());
        existing.setMaxProfilesPerCustomer(updated.getMaxProfilesPerCustomer());
        existing.setFeatures(updated.getFeatures());
        existing.setDescription(updated.getDescription());
        if (updated.getSortOrder() != null) existing.setSortOrder(updated.getSortOrder());
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

    @Transactional
    public void deleteForTenant(UUID id, UUID tenantId) {
        SubscriptionPlan plan = getById(id);
        if (!tenantId.equals(plan.getTenantId())) {
            throw ShieldException.forbidden("Plan does not belong to your tenant");
        }
        repo.delete(plan);
    }
}
