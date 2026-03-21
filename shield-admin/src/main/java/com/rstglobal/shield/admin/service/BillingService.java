package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.config.StripeConfig;
import com.rstglobal.shield.admin.dto.CheckoutResponse;
import com.rstglobal.shield.admin.dto.InvoiceResponse;
import com.rstglobal.shield.admin.dto.InvoicePdfResult;
import com.rstglobal.shield.admin.dto.SubscriptionResponse;
import com.rstglobal.shield.admin.entity.Invoice;
import com.rstglobal.shield.admin.entity.PaymentTransaction;
import com.rstglobal.shield.admin.entity.StripeCustomer;
import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.repository.InvoiceRepository;
import com.rstglobal.shield.admin.repository.PaymentTransactionRepository;
import com.rstglobal.shield.admin.repository.StripeCustomerRepository;
import com.rstglobal.shield.admin.repository.SubscriptionPlanRepository;
import com.rstglobal.shield.common.exception.ShieldException;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BillingService {

    private final StripeService stripeService;
    private final StripeConfig stripeConfig;
    private final InvoiceRepository invoiceRepo;
    private final PaymentTransactionRepository txnRepo;
    private final StripeCustomerRepository stripeCustomerRepo;
    private final SubscriptionPlanRepository planRepo;
    private final AuditLogService auditLogService;
    private final NotificationClient notificationClient;
    private final EntityManager entityManager;

    @Transactional
    public CheckoutResponse createCheckout(UUID userId, UUID tenantId, String email, String userName, UUID planId) {
        SubscriptionPlan plan = planRepo.findById(planId)
                .orElseThrow(() -> new RuntimeException("Plan not found: " + planId));

        String stripeCustomerId = stripeService.getOrCreateStripeCustomer(userId, tenantId, email, userName);
        Session session = stripeService.createCheckoutSession(stripeCustomerId, plan, userId);

        Invoice inv = Invoice.builder()
                .userId(userId).tenantId(tenantId).userEmail(email)
                .planId(planId).planName(plan.getName())
                .amount(plan.getPrice()).currency("INR")
                .status("PENDING")
                .stripeCheckoutSessionId(session.getId())
                .build();
        invoiceRepo.save(inv);

        log.info("Checkout initiated for user {} plan {}", userId, plan.getName());
        return new CheckoutResponse(session.getId(), session.getUrl(), stripeConfig.getPublishableKey());
    }

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

        // Record transaction
        txnRepo.save(PaymentTransaction.builder()
                .invoiceId(inv.getId())
                .amount(inv.getAmount())
                .currency(inv.getCurrency())
                .status("SUCCEEDED")
                .stripePaymentIntentId(session.getPaymentIntent())
                .build());

        // Update customer subscription via cross-schema query (also handles ISP admin tenant update)
        updateCustomerSubscription(inv.getUserId(), inv.getTenantId(), inv.getPlanName(), "ACTIVE", session.getSubscription());

        log.info("Checkout completed: invoice={}, user={}, plan={}", inv.getId(), inv.getUserId(), inv.getPlanName());
        auditLogService.log("SUBSCRIPTION_CREATED", "Invoice", inv.getId().toString(),
                inv.getUserId(), inv.getUserEmail(), null,
                java.util.Map.of("plan", inv.getPlanName(), "amount", inv.getAmount().toString()));

        // Send subscription-confirmed email (async, fire-and-forget)
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
        // Check if we already have this invoice (idempotent)
        if (invoiceRepo.findByStripeInvoiceId(stripeInvId).isPresent()) return;

        String subId = stripeInvoice.getSubscription();
        String custId = stripeInvoice.getCustomer();

        // Find our stripe customer
        Optional<StripeCustomer> sc = stripeCustomerRepo.findByStripeCustomerId(custId);
        if (sc.isEmpty()) {
            log.warn("Unknown Stripe customer {} for invoice {}", custId, stripeInvId);
            return;
        }
        StripeCustomer stripeCust = sc.get();

        BigDecimal amount = BigDecimal.valueOf(stripeInvoice.getAmountPaid()).divide(BigDecimal.valueOf(100));
        String planName = "UNKNOWN";

        // Try to find plan from subscription metadata or line items
        if (stripeInvoice.getLines() != null && !stripeInvoice.getLines().getData().isEmpty()) {
            var lineItem = stripeInvoice.getLines().getData().get(0);
            if (lineItem.getPrice() != null && lineItem.getPrice().getProduct() != null) {
                // Try to find plan by stripe product
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

        // Send invoice-paid email (async, fire-and-forget)
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
        if (sc.isEmpty()) return;

        log.warn("Payment failed for Stripe customer {} invoice {}", custId, stripeInvoice.getId());
        // Could mark customer as past_due or send notification
    }

    @Transactional
    public void handleSubscriptionDeleted(Subscription subscription) {
        String custId = subscription.getCustomer();
        Optional<StripeCustomer> sc = stripeCustomerRepo.findByStripeCustomerId(custId);
        if (sc.isEmpty()) return;

        updateCustomerSubscription(sc.get().getUserId(), sc.get().getTenantId(), "FREE", "CANCELLED", null);
        log.info("Subscription cancelled for user {}", sc.get().getUserId());
    }

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

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.charAt(0) + s.substring(1).toLowerCase();
    }

    public void cancelSubscription(UUID userId) {
        cancelSubscription(userId, null);
    }

    public void cancelSubscription(UUID userId, UUID tenantId) {
        SubscriptionResponse sub = getSubscription(userId, tenantId);
        if (sub.getStripeSubscriptionId() != null && !sub.getStripeSubscriptionId().isBlank()) {
            stripeService.cancelSubscription(sub.getStripeSubscriptionId());
        }
        updateCustomerSubscription(userId, tenantId, "FREE", "CANCELLED", null);
        log.info("User {} cancelled subscription", userId);
    }

    public Page<InvoiceResponse> getMyInvoices(UUID userId, Pageable pageable) {
        return invoiceRepo.findByUserId(userId, pageable).map(this::toResponse);
    }

    public Page<InvoiceResponse> listAllInvoices(Pageable pageable) {
        return invoiceRepo.findAll(pageable).map(this::toResponse);
    }

    public Page<InvoiceResponse> listInvoicesByTenant(UUID tenantId, Pageable pageable) {
        return invoiceRepo.findByTenantId(tenantId, pageable).map(this::toResponse);
    }

    public InvoiceResponse getInvoiceById(UUID id) {
        return invoiceRepo.findById(id).map(this::toResponse)
                .orElseThrow(() -> new RuntimeException("Invoice not found: " + id));
    }

    /**
     * Resolve invoice PDF: try stored pdfUrl, then Stripe API, then generate HTML.
     * Returns an InvoicePdfResult indicating redirect URL or inline HTML content.
     */
    public InvoicePdfResult resolveInvoicePdf(UUID invoiceId) {
        Invoice inv = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> ShieldException.notFound("Invoice", invoiceId));

        // 1. If pdfUrl already stored (from Stripe webhook), redirect to it
        if (inv.getPdfUrl() != null && !inv.getPdfUrl().isBlank()) {
            return InvoicePdfResult.redirect(inv.getPdfUrl());
        }

        // 2. If we have a stripeInvoiceId, fetch PDF URL from Stripe API
        if (inv.getStripeInvoiceId() != null && !inv.getStripeInvoiceId().isBlank()) {
            try {
                com.stripe.model.Invoice stripeInvoice =
                        com.stripe.model.Invoice.retrieve(inv.getStripeInvoiceId());
                String stripePdf = stripeInvoice.getInvoicePdf();
                if (stripePdf != null && !stripePdf.isBlank()) {
                    // Cache it for next time
                    inv.setPdfUrl(stripePdf);
                    invoiceRepo.save(inv);
                    return InvoicePdfResult.redirect(stripePdf);
                }
            } catch (Exception e) {
                log.warn("Failed to fetch Stripe invoice PDF for {}: {}", inv.getStripeInvoiceId(), e.getMessage());
            }
        }

        // 3. Generate HTML invoice that can be printed as PDF
        return InvoicePdfResult.html(generateInvoiceHtml(inv));
    }

    /**
     * Resolve invoice PDF for a specific user (validates ownership).
     */
    public InvoicePdfResult resolveInvoicePdfForUser(UUID invoiceId, UUID userId) {
        Invoice inv = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> ShieldException.notFound("Invoice", invoiceId));
        if (!inv.getUserId().equals(userId)) {
            throw ShieldException.forbidden("You do not own this invoice");
        }
        return resolveInvoicePdf(invoiceId);
    }

    private String generateInvoiceHtml(Invoice inv) {
        String invoiceDate = inv.getCreatedAt() != null
                ? inv.getCreatedAt().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
                : "N/A";
        String periodStart = inv.getBillingPeriodStart() != null
                ? inv.getBillingPeriodStart().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
                : "—";
        String periodEnd = inv.getBillingPeriodEnd() != null
                ? inv.getBillingPeriodEnd().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
                : "—";
        String currencySymbol = "INR".equalsIgnoreCase(inv.getCurrency()) ? "\u20B9" : inv.getCurrency() + " ";

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Invoice — Shield</title>
                <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                       background: #F5F5F5; color: #1E293B; padding: 20px; }
                .invoice { max-width: 800px; margin: 0 auto; background: #FFF; border-radius: 12px;
                           box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; }
                .header { background: linear-gradient(135deg, #1565C0, #0D47A1); color: #FFF; padding: 40px; }
                .header h1 { font-size: 28px; margin-bottom: 4px; }
                .header p { opacity: 0.85; font-size: 14px; }
                .body { padding: 40px; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
                .meta-block h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px;
                                  color: #64748B; margin-bottom: 6px; }
                .meta-block p { font-size: 15px; }
                table { width: 100%%; border-collapse: collapse; margin-bottom: 24px; }
                th { background: #F8FAFC; text-align: left; padding: 12px 16px; font-size: 12px;
                     text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; border-bottom: 2px solid #E2E8F0; }
                td { padding: 14px 16px; border-bottom: 1px solid #F1F5F9; font-size: 15px; }
                .total-row td { font-weight: 700; font-size: 18px; border-top: 2px solid #1565C0;
                                border-bottom: none; }
                .status { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px;
                          font-weight: 600; }
                .status-paid { background: #E8F5E9; color: #2E7D32; }
                .status-pending { background: #FFF3E0; color: #E65100; }
                .footer { text-align: center; padding: 24px 40px; background: #F8FAFC;
                          font-size: 13px; color: #94A3B8; }
                @media print {
                  body { background: #FFF; padding: 0; }
                  .invoice { box-shadow: none; border-radius: 0; }
                  .no-print { display: none; }
                }
                .print-btn { display: block; margin: 20px auto; padding: 10px 32px; background: #1565C0;
                             color: #FFF; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
                .print-btn:hover { background: #0D47A1; }
                </style>
                </head>
                <body>
                <div class="invoice">
                  <div class="header">
                    <h1>Shield</h1>
                    <p>Family Internet Safety Platform</p>
                  </div>
                  <div class="body">
                    <div class="meta">
                      <div class="meta-block">
                        <h3>Invoice Number</h3>
                        <p>%s</p>
                      </div>
                      <div class="meta-block">
                        <h3>Date</h3>
                        <p>%s</p>
                      </div>
                      <div class="meta-block">
                        <h3>Status</h3>
                        <p><span class="status %s">%s</span></p>
                      </div>
                      <div class="meta-block">
                        <h3>Billed To</h3>
                        <p>%s</p>
                      </div>
                    </div>
                    <table>
                      <thead>
                        <tr><th>Description</th><th>Period</th><th style="text-align:right">Amount</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Shield %s Plan</td>
                          <td>%s — %s</td>
                          <td style="text-align:right">%s%s</td>
                        </tr>
                        <tr class="total-row">
                          <td colspan="2">Total</td>
                          <td style="text-align:right">%s%s</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="footer">
                    <p>Shield by RST Global &bull; shield.rstglobal.in</p>
                  </div>
                </div>
                <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
                </body>
                </html>
                """.formatted(
                inv.getId().toString().substring(0, 8).toUpperCase(),
                invoiceDate,
                "PAID".equalsIgnoreCase(inv.getStatus()) ? "status-paid" : "status-pending",
                inv.getStatus(),
                inv.getUserEmail(),
                inv.getPlanName(),
                periodStart, periodEnd,
                currencySymbol, inv.getAmount(),
                currencySymbol, inv.getAmount()
        );
    }

    private void updateCustomerSubscription(UUID userId, String planName, String status, String stripeSubId) {
        updateCustomerSubscription(userId, null, planName, status, stripeSubId);
    }

    private void updateCustomerSubscription(UUID userId, UUID tenantId, String planName, String status, String stripeSubId) {
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
                // Serialize plan features for tenant update
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

    private InvoiceResponse toResponse(Invoice inv) {
        // Enrich: tenant name
        String tenantName = null;
        if (inv.getTenantId() != null) {
            try {
                tenantName = (String) entityManager.createNativeQuery(
                        "SELECT name FROM tenant.tenants WHERE id = :tid")
                        .setParameter("tid", inv.getTenantId()).getSingleResult();
            } catch (Exception ignored) {}
        }
        // Enrich: real user email/name when stored email is placeholder
        String userEmail = inv.getUserEmail();
        String userName = null;
        if (inv.getUserId() != null) {
            try {
                Object[] row = (Object[]) entityManager.createNativeQuery(
                        "SELECT email, name FROM auth.users WHERE id = :uid")
                        .setParameter("uid", inv.getUserId()).getSingleResult();
                if (row[0] != null && (userEmail == null || userEmail.isBlank() || "user@shield.app".equals(userEmail))) {
                    userEmail = (String) row[0];
                }
                if (row[1] != null) userName = (String) row[1];
            } catch (Exception ignored) {}
        }
        return InvoiceResponse.builder()
                .id(inv.getId())
                .tenantId(inv.getTenantId())
                .customerId(inv.getCustomerId())
                .userId(inv.getUserId())
                .userEmail(userEmail)
                .tenantName(tenantName)
                .userName(userName)
                .planName(inv.getPlanName())
                .amount(inv.getAmount())
                .currency(inv.getCurrency())
                .status(inv.getStatus())
                .stripeInvoiceId(inv.getStripeInvoiceId())
                .pdfUrl(inv.getPdfUrl())
                .billingPeriodStart(inv.getBillingPeriodStart())
                .billingPeriodEnd(inv.getBillingPeriodEnd())
                .createdAt(inv.getCreatedAt())
                .build();
    }
}
