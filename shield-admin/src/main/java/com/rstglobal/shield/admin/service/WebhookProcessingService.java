package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.SubscriptionResponse;
import com.rstglobal.shield.admin.entity.Invoice;
import com.rstglobal.shield.admin.entity.PaymentTransaction;
import com.rstglobal.shield.admin.entity.StripeCustomer;
import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.repository.InvoiceRepository;
import com.rstglobal.shield.admin.repository.PaymentTransactionRepository;
import com.rstglobal.shield.admin.repository.StripeCustomerRepository;
import com.rstglobal.shield.admin.repository.SubscriptionPlanRepository;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookProcessingService {

    private final InvoiceRepository invoiceRepo;
    private final PaymentTransactionRepository txnRepo;
    private final StripeCustomerRepository stripeCustomerRepo;
    private final SubscriptionPlanRepository planRepo;
    private final AuditLogService auditLogService;
    private final NotificationClient notificationClient;
    private final EntityManager entityManager;
    private final SubscriptionQueryService subscriptionQueryService;

    @Transactional
    public void handleCheckoutCompleted(Session session) {
        String sessionId = session.getId();
        Optional<Invoice> existing = invoiceRepo.findByStripeCheckoutSessionId(sessionId);
        if (existing.isEmpty()) {
            log.warn("No invoice found for checkout session {}", sessionId);
            return;
        }
        Invoice inv = existing.get();
        if ("PAID".equals(inv.getStatus())) return; // idempotent

        inv.setStatus("PAID");
        inv.setStripeSubscriptionId(session.getSubscription());
        inv.setStripePaymentIntentId(session.getPaymentIntent());
        invoiceRepo.save(inv);

        txnRepo.save(PaymentTransaction.builder()
                .invoiceId(inv.getId())
                .amount(inv.getAmount())
                .currency(inv.getCurrency())
                .status("SUCCEEDED")
                .stripePaymentIntentId(session.getPaymentIntent())
                .build());

        SubscriptionResponse existingSub = subscriptionQueryService.getSubscription(inv.getUserId(), inv.getTenantId());
        String newSubStatus = SubscriptionStateMachine.transition(
            existingSub.getStatus(), SubscriptionStateMachine.ACTIVE,
            "checkout.session.completed:" + session.getId());
        subscriptionQueryService.updateCustomerSubscription(inv.getUserId(), inv.getTenantId(), inv.getPlanName(), newSubStatus, session.getSubscription());

        log.info("Checkout completed: invoice={}, user={}, plan={}", inv.getId(), inv.getUserId(), inv.getPlanName());
        auditLogService.log("SUBSCRIPTION_CREATED", "Invoice", inv.getId().toString(),
                inv.getUserId(), inv.getUserEmail(), null,
                java.util.Map.of("plan", inv.getPlanName(), "amount", inv.getAmount().toString()));

        SubscriptionPlan plan = inv.getPlanId() != null ? planRepo.findById(inv.getPlanId()).orElse(null) : null;
        java.util.List<String> featureNames = plan != null && plan.getFeatures() != null
                ? plan.getFeatures().entrySet().stream()
                    .filter(java.util.Map.Entry::getValue)
                    .map(java.util.Map.Entry::getKey)
                    .toList()
                : null;
        int maxProfiles = plan != null ? plan.getMaxProfilesPerCustomer() : 5;
        notificationClient.sendSubscriptionConfirmedEmail(
                inv.getUserEmail(), null, inv.getPlanName(),
                featureNames, maxProfiles, inv.getTenantId());
    }

    @Transactional
    public void handleInvoicePaid(com.stripe.model.Invoice stripeInvoice) {
        String stripeInvId = stripeInvoice.getId();
        if (invoiceRepo.findByStripeInvoiceId(stripeInvId).isPresent()) return;

        String subId = stripeInvoice.getSubscription();
        String custId = stripeInvoice.getCustomer();

        Optional<StripeCustomer> sc = stripeCustomerRepo.findByStripeCustomerId(custId);
        if (sc.isEmpty()) {
            log.warn("Unknown Stripe customer {} for invoice {}", custId, stripeInvId);
            return;
        }
        StripeCustomer stripeCust = sc.get();

        BigDecimal amount = BigDecimal.valueOf(stripeInvoice.getAmountPaid()).divide(BigDecimal.valueOf(100));
        String planName = "UNKNOWN";

        if (stripeInvoice.getLines() != null && !stripeInvoice.getLines().getData().isEmpty()) {
            var lineItem = stripeInvoice.getLines().getData().get(0);
            if (lineItem.getPrice() != null && lineItem.getPrice().getProduct() != null) {
                String productId = lineItem.getPrice().getProduct();
                planName = planRepo.findByStripeProductId(productId)
                        .map(SubscriptionPlan::getName)
                        .orElse(planName);
            }
        }

        Invoice inv = Invoice.builder()
                .userId(stripeCust.getUserId())
                .tenantId(stripeCust.getTenantId())
                .userEmail(stripeCust.getEmail())
                .planName(planName)
                .amount(amount)
                .currency(stripeInvoice.getCurrency().toUpperCase())
                .status("PAID")
                .stripeInvoiceId(stripeInvId)
                .stripeSubscriptionId(subId)
                .stripePaymentIntentId(stripeInvoice.getPaymentIntent())
                .pdfUrl(stripeInvoice.getInvoicePdf())
                .billingPeriodStart(stripeInvoice.getPeriodStart() != null
                        ? OffsetDateTime.ofInstant(Instant.ofEpochSecond(stripeInvoice.getPeriodStart()), ZoneOffset.UTC)
                        : null)
                .billingPeriodEnd(stripeInvoice.getPeriodEnd() != null
                        ? OffsetDateTime.ofInstant(Instant.ofEpochSecond(stripeInvoice.getPeriodEnd()), ZoneOffset.UTC)
                        : null)
                .build();
        invoiceRepo.save(inv);

        txnRepo.save(PaymentTransaction.builder()
                .invoiceId(inv.getId())
                .amount(amount)
                .currency(inv.getCurrency())
                .status("SUCCEEDED")
                .stripePaymentIntentId(stripeInvoice.getPaymentIntent())
                .build());

        log.info("Recurring invoice paid: {}, user={}, amount={}", stripeInvId, stripeCust.getUserId(), amount);

        notificationClient.sendInvoicePaidEmail(
                stripeCust.getEmail(), null, stripeInvId,
                planName, amount, inv.getCurrency(),
                inv.getBillingPeriodStart(), inv.getBillingPeriodEnd(),
                stripeCust.getTenantId());
    }

    @Transactional
    public void handleInvoicePaymentFailed(com.stripe.model.Invoice stripeInvoice) {
        String custId = stripeInvoice.getCustomer();
        Optional<StripeCustomer> sc = stripeCustomerRepo.findByStripeCustomerId(custId);
        if (sc.isEmpty()) {
            log.warn("Unknown Stripe customer {} for payment_failed invoice {}", custId, stripeInvoice.getId());
            return;
        }
        StripeCustomer stripeCust = sc.get();

        int currentDunningCount = 0;
        try {
            Object row = entityManager.createNativeQuery(
                    "SELECT dunning_count FROM profile.customers WHERE user_id = :uid")
                    .setParameter("uid", stripeCust.getUserId())
                    .getSingleResult();
            if (row != null) currentDunningCount = ((Number) row).intValue();
        } catch (Exception e) {
            log.debug("Could not read dunning_count for user {}: {}", stripeCust.getUserId(), e.getMessage());
        }
        int newDunningCount = currentDunningCount + 1;

        int retryDays = switch (newDunningCount) {
            case 1  -> 2;
            case 2  -> 4;
            default -> 7;
        };
        Instant nextRetryAt = Instant.now().plus(retryDays, ChronoUnit.DAYS);

        boolean suspend = newDunningCount >= 3;
        Instant gracePeriodEndsAt = suspend ? Instant.now().plus(30, ChronoUnit.DAYS) : null;

        SubscriptionResponse current = subscriptionQueryService.getSubscription(stripeCust.getUserId(), stripeCust.getTenantId());
        String targetStatus = suspend ? SubscriptionStateMachine.SUSPENDED : SubscriptionStateMachine.PAST_DUE;
        String newStatus = SubscriptionStateMachine.transition(
            current.getStatus(), targetStatus,
            "invoice.payment_failed:" + stripeInvoice.getId());

        subscriptionQueryService.updateCustomerSubscription(stripeCust.getUserId(), stripeCust.getTenantId(),
            current.getPlanName() != null ? current.getPlanName() : "FREE",
            newStatus, current.getStripeSubscriptionId());

        try {
            if (gracePeriodEndsAt != null) {
                entityManager.createNativeQuery(
                        "UPDATE profile.customers SET dunning_count = :dc, next_retry_at = :nra, " +
                        "grace_period_ends_at = :gpa, updated_at = now() WHERE user_id = :uid")
                        .setParameter("dc", newDunningCount)
                        .setParameter("nra", java.sql.Timestamp.from(nextRetryAt))
                        .setParameter("gpa", java.sql.Timestamp.from(gracePeriodEndsAt))
                        .setParameter("uid", stripeCust.getUserId())
                        .executeUpdate();
            } else {
                entityManager.createNativeQuery(
                        "UPDATE profile.customers SET dunning_count = :dc, next_retry_at = :nra, " +
                        "updated_at = now() WHERE user_id = :uid")
                        .setParameter("dc", newDunningCount)
                        .setParameter("nra", java.sql.Timestamp.from(nextRetryAt))
                        .setParameter("uid", stripeCust.getUserId())
                        .executeUpdate();
            }
        } catch (Exception e) {
            log.warn("Failed to update dunning fields for user {}: {}", stripeCust.getUserId(), e.getMessage());
        }

        BigDecimal amount = BigDecimal.valueOf(stripeInvoice.getAmountDue() != null
            ? stripeInvoice.getAmountDue() : 0L).divide(BigDecimal.valueOf(100));

        Invoice inv = Invoice.builder()
            .userId(stripeCust.getUserId())
            .tenantId(stripeCust.getTenantId())
            .userEmail(stripeCust.getEmail())
            .planName(current.getPlanName() != null ? current.getPlanName() : "UNKNOWN")
            .amount(amount)
            .currency(stripeInvoice.getCurrency() != null ? stripeInvoice.getCurrency().toUpperCase() : "INR")
            .status("FAILED")
            .stripeInvoiceId(stripeInvoice.getId())
            .stripeSubscriptionId(stripeInvoice.getSubscription())
            .build();
        invoiceRepo.save(inv);

        log.warn("Payment failed (attempt={}) → {}: user={}, invoice={}, nextRetry={}",
            newDunningCount, newStatus, stripeCust.getUserId(), stripeInvoice.getId(), nextRetryAt);
        auditLogService.log("PAYMENT_FAILED", "Invoice", stripeInvoice.getId(),
            stripeCust.getUserId(), stripeCust.getEmail(), null,
            java.util.Map.of("amount", amount.toString(), "status", newStatus,
                "dunningCount", String.valueOf(newDunningCount)));

        if (suspend) {
            auditLogService.log("SUBSCRIPTION_SUSPENDED", "Customer", stripeCust.getUserId().toString(),
                stripeCust.getUserId(), stripeCust.getEmail(), null,
                java.util.Map.of("reason", "dunning_exhausted", "gracePeriodEndsAt", gracePeriodEndsAt.toString()));
        }

        notificationClient.sendPaymentFailedEmail(
            stripeCust.getEmail(), null, stripeInvoice.getId(),
            amount, inv.getCurrency(), newDunningCount, nextRetryAt, stripeCust.getTenantId());
    }

    @Transactional
    public void handleSubscriptionUpdated(Subscription subscription) {
        String custId = subscription.getCustomer();
        Optional<StripeCustomer> sc = stripeCustomerRepo.findByStripeCustomerId(custId);
        if (sc.isEmpty()) {
            log.debug("No StripeCustomer found for subscription.updated event, customerId={}", custId);
            return;
        }
        StripeCustomer stripeCust = sc.get();

        String stripeStatus = subscription.getStatus();
        String targetStatus = switch (stripeStatus) {
            case "active", "trialing"   -> SubscriptionStateMachine.ACTIVE;
            case "past_due", "unpaid"   -> SubscriptionStateMachine.PAST_DUE;
            case "canceled"             -> SubscriptionStateMachine.CANCELLED;
            case "incomplete_expired"   -> SubscriptionStateMachine.SUSPENDED;
            default -> null;
        };

        if (targetStatus == null) {
            log.debug("Ignoring subscription.updated with status={}", stripeStatus);
            return;
        }

        SubscriptionResponse current = subscriptionQueryService.getSubscription(stripeCust.getUserId(), stripeCust.getTenantId());
        String newStatus = SubscriptionStateMachine.transition(
            current.getStatus(), targetStatus,
            "subscription.updated:" + subscription.getId());

        if (!newStatus.equals(current.getStatus())) {
            subscriptionQueryService.updateCustomerSubscription(stripeCust.getUserId(), stripeCust.getTenantId(),
                current.getPlanName() != null ? current.getPlanName() : "FREE",
                newStatus, subscription.getId());
            log.info("Subscription updated: user={}, {} → {}", stripeCust.getUserId(), current.getStatus(), newStatus);
        }
    }

    @Transactional
    public void handleChargeRefunded(Charge charge) {
        String stripePaymentIntentId = charge.getPaymentIntent();
        if (stripePaymentIntentId == null || stripePaymentIntentId.isBlank()) {
            log.debug("charge.refunded with no paymentIntent — skipping");
            return;
        }

        invoiceRepo.findByStripePaymentIntentId(stripePaymentIntentId).ifPresent(inv -> {
            inv.setStatus("REFUNDED");
            invoiceRepo.save(inv);
            log.info("Invoice {} marked REFUNDED (charge={})", inv.getId(), charge.getId());
            auditLogService.log("PAYMENT_REFUNDED", "Invoice", inv.getId().toString(),
                inv.getUserId(), inv.getUserEmail(), null,
                java.util.Map.of("chargeId", charge.getId()));
        });
    }

    @Transactional
    public void handlePaymentActionRequired(PaymentIntent paymentIntent) {
        String custId = paymentIntent.getCustomer();
        if (custId == null || custId.isBlank()) return;

        stripeCustomerRepo.findByStripeCustomerId(custId).ifPresent(sc ->
            notificationClient.sendPaymentActionRequiredEmail(
                sc.getEmail(), null, paymentIntent.getId(), sc.getTenantId())
        );
        log.info("payment_intent.requires_action for customer={}, intent={}", custId, paymentIntent.getId());
    }

    @Transactional
    public void handleSubscriptionDeleted(Subscription subscription) {
        String custId = subscription.getCustomer();
        Optional<StripeCustomer> sc = stripeCustomerRepo.findByStripeCustomerId(custId);
        if (sc.isEmpty()) return;

        StripeCustomer stripeCust = sc.get();
        SubscriptionResponse current = subscriptionQueryService.getSubscription(stripeCust.getUserId(), stripeCust.getTenantId());
        String newStatus = SubscriptionStateMachine.transition(
            current.getStatus(), SubscriptionStateMachine.CANCELLED,
            "subscription.deleted:" + subscription.getId());
        subscriptionQueryService.updateCustomerSubscription(stripeCust.getUserId(), stripeCust.getTenantId(), "FREE", newStatus, null);
        log.info("Subscription cancelled for user {}", stripeCust.getUserId());
    }
}
