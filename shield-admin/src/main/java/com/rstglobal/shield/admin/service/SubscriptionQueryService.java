package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.SubscriptionResponse;
import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.repository.SubscriptionPlanRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionQueryService {

    private final SubscriptionPlanRepository planRepo;
    private final EntityManager entityManager;
    private final AuditLogService auditLogService;
    private final NotificationClient notificationClient;
    private final StripeService stripeService;

    public SubscriptionResponse getSubscription(UUID userId) {
        return getSubscription(userId, null);
    }

    public SubscriptionResponse getSubscription(UUID userId, UUID tenantId) {
        // First try customer subscription (CUSTOMER role)
        try {
            Object[] row = (Object[]) entityManager.createNativeQuery(
                    "SELECT c.subscription_plan, c.subscription_status, c.subscription_expires_at, " +
                    "c.stripe_subscription_id, c.max_profiles " +
                    "FROM profile.customers c WHERE c.user_id = :uid")
                    .setParameter("uid", userId)
                    .getSingleResult();

            String planName = (String) row[0];
            SubscriptionPlan plan = planRepo.findByName(planName).orElse(null);

            return SubscriptionResponse.builder()
                    .planName(planName)
                    .planDisplayName(plan != null ? plan.getDisplayName() : planName)
                    .price(plan != null ? plan.getPrice() : BigDecimal.ZERO)
                    .billingCycle(plan != null ? plan.getBillingCycle() : "MONTHLY")
                    .status((String) row[1])
                    .expiresAt(row[2] != null ? ((java.sql.Timestamp) row[2]).toInstant() : null)
                    .stripeSubscriptionId((String) row[3])
                    .features(plan != null ? plan.getFeatures() : null)
                    .maxProfiles(row[4] != null ? ((Number) row[4]).intValue() : 5)
                    .build();
        } catch (Exception e) {
            log.debug("No customer subscription found for user {}, trying tenant", userId);
        }

        // Fallback: ISP admin — look up tenant plan
        if (tenantId != null) {
            try {
                Object[] row = (Object[]) entityManager.createNativeQuery(
                        "SELECT t.plan, t.is_active, t.subscription_ends_at, t.max_customers, t.max_profiles_per_customer " +
                        "FROM tenant.tenants t WHERE t.id = :tid")
                        .setParameter("tid", tenantId)
                        .getSingleResult();

                String planName = row[0] != null ? row[0].toString() : "STARTER";
                boolean isActive = row[1] != null && (Boolean) row[1];
                SubscriptionPlan plan = planRepo.findByName(planName).orElse(null);

                return SubscriptionResponse.builder()
                        .planName(planName)
                        .planDisplayName(plan != null ? plan.getDisplayName() : capitalize(planName) + " Plan")
                        .price(plan != null ? plan.getPrice() : BigDecimal.ZERO)
                        .billingCycle(plan != null ? plan.getBillingCycle() : "MONTHLY")
                        .status(isActive ? "ACTIVE" : "SUSPENDED")
                        .expiresAt(row[2] != null ? ((java.sql.Timestamp) row[2]).toInstant() : null)
                        .features(plan != null ? plan.getFeatures() : null)
                        .maxCustomers(row[3] != null ? ((Number) row[3]).intValue() : 100)
                        .maxProfiles(row[4] != null ? ((Number) row[4]).intValue() : 5)
                        .build();
            } catch (Exception ex) {
                log.debug("No tenant found for tenantId {}", tenantId);
            }
        }

        return SubscriptionResponse.builder()
                .planName("FREE").planDisplayName("Free Plan").status("NONE")
                .build();
    }

    @Transactional
    public void updateCustomerSubscription(UUID userId, String planName, String status, String stripeSubId) {
        updateCustomerSubscription(userId, null, planName, status, stripeSubId);
    }

    @Transactional
    public void updateCustomerSubscription(UUID userId, UUID tenantId, String planName, String status, String stripeSubId) {
        try {
            SubscriptionPlan plan = planRepo.findByName(planName).orElse(null);
            int maxProfiles = plan != null ? plan.getMaxProfilesPerCustomer() : 5;
            int updated = entityManager.createNativeQuery(
                    "UPDATE profile.customers SET subscription_plan = :plan, subscription_status = :status, " +
                    "stripe_subscription_id = :subId, max_profiles = :mp, updated_at = now() " +
                    "WHERE user_id = :uid")
                    .setParameter("plan", planName)
                    .setParameter("status", status)
                    .setParameter("subId", stripeSubId)
                    .setParameter("mp", maxProfiles)
                    .setParameter("uid", userId)
                    .executeUpdate();

            // If no customer row updated and we have a tenantId, update the tenant's plan (ISP admin)
            if (updated == 0 && tenantId != null) {
                boolean active = "ACTIVE".equals(status);
                String featuresJson = null;
                int maxCustomers = plan != null ? plan.getMaxCustomers() : 100;
                int maxProfilesPerCustomer = plan != null ? plan.getMaxProfilesPerCustomer() : 5;
                if (plan != null && plan.getFeatures() != null && !plan.getFeatures().isEmpty()) {
                    try {
                        featuresJson = new com.fasterxml.jackson.databind.ObjectMapper()
                                .writeValueAsString(plan.getFeatures());
                    } catch (Exception ex) {
                        log.warn("Failed to serialize plan features: {}", ex.getMessage());
                    }
                }
                try {
                    if (featuresJson != null) {
                        entityManager.createNativeQuery(
                                "UPDATE tenant.tenants SET plan = :plan, is_active = :active, " +
                                "features = CAST(:features AS jsonb), max_customers = :maxCust, " +
                                "max_profiles_per_customer = :maxProf, updated_at = now() " +
                                "WHERE id = :tid")
                                .setParameter("plan", planName)
                                .setParameter("active", active)
                                .setParameter("features", featuresJson)
                                .setParameter("maxCust", maxCustomers)
                                .setParameter("maxProf", maxProfilesPerCustomer)
                                .setParameter("tid", tenantId)
                                .executeUpdate();
                    } else {
                        entityManager.createNativeQuery(
                                "UPDATE tenant.tenants SET plan = :plan, is_active = :active, " +
                                "max_customers = :maxCust, max_profiles_per_customer = :maxProf, updated_at = now() " +
                                "WHERE id = :tid")
                                .setParameter("plan", planName)
                                .setParameter("active", active)
                                .setParameter("maxCust", maxCustomers)
                                .setParameter("maxProf", maxProfilesPerCustomer)
                                .setParameter("tid", tenantId)
                                .executeUpdate();
                    }
                    log.info("Updated tenant {} plan to {} with features (ISP admin billing)", tenantId, planName);
                } catch (Exception ex) {
                    log.error("Failed to update tenant plan for tenant {}", tenantId, ex);
                }
            }
        } catch (Exception e) {
            log.error("Failed to update subscription for user {} / tenant {}", userId, tenantId, e);
        }
    }

    public void cancelSubscription(UUID userId) {
        cancelSubscription(userId, null);
    }

    @Transactional
    public void cancelSubscription(UUID userId, UUID tenantId) {
        SubscriptionResponse sub = getSubscription(userId, tenantId);
        if (sub.getStripeSubscriptionId() != null && !sub.getStripeSubscriptionId().isBlank()) {
            stripeService.cancelSubscription(sub.getStripeSubscriptionId());
        }
        updateCustomerSubscription(userId, tenantId, "FREE", "CANCELLED", null);
        log.info("User {} cancelled subscription", userId);
    }

    @Transactional
    public void changePlan(UUID customerId, String newPriceId) {
        Object[] row;
        try {
            row = (Object[]) entityManager.createNativeQuery(
                    "SELECT c.user_id, c.tenant_id, c.stripe_subscription_id, c.subscription_plan " +
                    "FROM profile.customers c WHERE c.id = :cid")
                    .setParameter("cid", customerId)
                    .getSingleResult();
        } catch (Exception e) {
            throw new RuntimeException("Customer not found: " + customerId, e);
        }

        UUID userId            = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
        UUID tenantId          = row[1] != null ? (row[1] instanceof UUID u ? u : UUID.fromString(row[1].toString())) : null;
        String stripeSubId     = (String) row[2];
        String currentPlanName = (String) row[3];

        if (stripeSubId == null || stripeSubId.isBlank()) {
            throw new RuntimeException("No active Stripe subscription found for customer " + customerId);
        }

        SubscriptionPlan newPlan = planRepo.findByStripePriceId(newPriceId).orElse(null);
        String newPlanName = newPlan != null ? newPlan.getName() : currentPlanName;

        stripeService.changePlan(stripeSubId, newPriceId);
        updateCustomerSubscription(userId, tenantId, newPlanName, "ACTIVE", stripeSubId);

        auditLogService.log("PLAN_CHANGED", "Customer", customerId.toString(),
                userId, null, null,
                java.util.Map.of("from", currentPlanName, "to", newPlanName, "newPriceId", newPriceId));

        log.info("Plan changed for customer={} user={} from={} to={}", customerId, userId, currentPlanName, newPlanName);
    }

    @Transactional
    public void startTrial(UUID userId, UUID tenantId, int trialDays) {
        if (trialDays < 1 || trialDays > 365) {
            throw new IllegalArgumentException("trialDays must be between 1 and 365");
        }
        Instant trialEndsAt = Instant.now().plus(trialDays, ChronoUnit.DAYS);
        int updated = entityManager.createNativeQuery(
                "UPDATE profile.customers SET is_trial = true, trial_ends_at = :endsAt, " +
                "subscription_status = 'TRIAL', updated_at = now() WHERE user_id = :uid")
                .setParameter("endsAt", java.sql.Timestamp.from(trialEndsAt))
                .setParameter("uid", userId)
                .executeUpdate();
        if (updated == 0) {
            entityManager.createNativeQuery(
                    "INSERT INTO profile.customers " +
                    "(id, user_id, tenant_id, subscription_plan, subscription_status, is_trial, trial_ends_at, max_profiles, created_at, updated_at) " +
                    "VALUES (gen_random_uuid(), :uid, :tid, 'FREE', 'TRIAL', true, :endsAt, 1, now(), now()) " +
                    "ON CONFLICT (user_id) DO UPDATE SET is_trial = true, trial_ends_at = :endsAt, " +
                    "subscription_status = 'TRIAL', updated_at = now()")
                    .setParameter("uid", userId)
                    .setParameter("tid", tenantId)
                    .setParameter("endsAt", java.sql.Timestamp.from(trialEndsAt))
                    .executeUpdate();
        }
        auditLogService.log("TRIAL_STARTED", "Customer", userId.toString(),
                userId, null, null,
                java.util.Map.of("trialDays", String.valueOf(trialDays), "trialEndsAt", trialEndsAt.toString()));
        log.info("Trial started for user={} tenantId={} endsAt={}", userId, tenantId, trialEndsAt);
    }

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void expireTrials() {
        log.info("Running trial expiry job");
        try {
            @SuppressWarnings("unchecked")
            List<Object[]> rows = (List<Object[]>) entityManager.createNativeQuery(
                    "SELECT c.user_id, c.tenant_id, u.email, u.name " +
                    "FROM profile.customers c " +
                    "JOIN auth.users u ON u.id = c.user_id " +
                    "WHERE c.is_trial = true AND c.trial_ends_at < now()")
                    .getResultList();

            if (rows.isEmpty()) {
                log.debug("No expired trials found");
                return;
            }
            log.info("Expiring {} trial account(s)", rows.size());

            for (Object[] row : rows) {
                try {
                    UUID userId   = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
                    UUID tenantId = row[1] != null ? (row[1] instanceof UUID u ? u : UUID.fromString(row[1].toString())) : null;
                    String email  = (String) row[2];
                    String name   = (String) row[3];

                    entityManager.createNativeQuery(
                            "UPDATE profile.customers SET is_trial = false, subscription_status = 'TRIAL_EXPIRED', " +
                            "updated_at = now() WHERE user_id = :uid")
                            .setParameter("uid", userId)
                            .executeUpdate();

                    auditLogService.log("TRIAL_EXPIRED", "Customer", userId.toString(),
                            userId, email, null, java.util.Map.of("tenantId", tenantId != null ? tenantId.toString() : ""));

                    notificationClient.sendTrialExpiredEmail(email, name, tenantId);
                    log.info("Trial expired for user={}", userId);
                } catch (Exception e) {
                    log.warn("Failed to expire trial for row: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Trial expiry job failed: {}", e.getMessage(), e);
        }
    }

    @Scheduled(cron = "0 0 9 * * *")
    public void sendRenewalReminders() {
        log.info("Running subscription renewal reminder job");
        try {
            Instant windowStart = Instant.now().plus(6, ChronoUnit.DAYS);
            Instant windowEnd   = Instant.now().plus(8, ChronoUnit.DAYS);

            @SuppressWarnings("unchecked")
            List<Object[]> rows = (List<Object[]>) entityManager.createNativeQuery(
                    "SELECT c.user_id, c.tenant_id, c.subscription_plan, c.subscription_expires_at, " +
                    "u.email, u.name " +
                    "FROM profile.customers c " +
                    "JOIN auth.users u ON u.id = c.user_id " +
                    "WHERE c.subscription_status = 'ACTIVE' " +
                    "  AND c.subscription_expires_at >= :ws " +
                    "  AND c.subscription_expires_at <= :we")
                    .setParameter("ws", java.sql.Timestamp.from(windowStart))
                    .setParameter("we", java.sql.Timestamp.from(windowEnd))
                    .getResultList();

            log.info("Found {} subscriptions renewing in ~7 days", rows.size());
            for (Object[] row : rows) {
                try {
                    UUID userId      = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
                    UUID tenantId    = row[1] != null ? (row[1] instanceof UUID u ? u : UUID.fromString(row[1].toString())) : null;
                    String planName  = (String) row[2];
                    Instant renewsAt = row[3] != null ? ((java.sql.Timestamp) row[3]).toInstant() : null;
                    String email     = (String) row[4];
                    String name      = (String) row[5];

                    if (email == null || email.isBlank()) continue;

                    SubscriptionPlan plan = planRepo.findByName(planName).orElse(null);
                    java.math.BigDecimal amount = plan != null ? plan.getPrice() : java.math.BigDecimal.ZERO;

                    notificationClient.sendRenewalReminderEmail(email, name, planName, amount, "INR", renewsAt, tenantId);
                    log.debug("Renewal reminder queued for user={}, plan={}, renewsAt={}", userId, planName, renewsAt);
                } catch (Exception e) {
                    log.warn("Failed to send renewal reminder for row: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Renewal reminder job failed: {}", e.getMessage(), e);
        }
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.charAt(0) + s.substring(1).toLowerCase();
    }
}
