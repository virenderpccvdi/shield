package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.CheckoutResponse;
import com.rstglobal.shield.admin.dto.InvoicePdfResult;
import com.rstglobal.shield.admin.dto.InvoiceResponse;
import com.rstglobal.shield.admin.dto.SubscriptionResponse;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Facade that delegates to focused billing sub-services.
 * Existing callers continue to work without changes.
 */
@Service
@RequiredArgsConstructor
public class BillingService {

    private final StripeCheckoutService checkoutService;
    private final WebhookProcessingService webhookService;
    private final InvoiceService invoiceService;
    private final SubscriptionQueryService subscriptionService;

    // ── Checkout ─────────────────────────────────────────────────────────────

    public CheckoutResponse createCheckout(UUID userId, UUID tenantId, String email, String userName, UUID planId) {
        return checkoutService.createCheckout(userId, tenantId, email, userName, planId);
    }

    // ── Webhook handlers ──────────────────────────────────────────────────────

    public void handleCheckoutCompleted(Session session)                        { webhookService.handleCheckoutCompleted(session); }
    public void handleInvoicePaid(com.stripe.model.Invoice invoice)             { webhookService.handleInvoicePaid(invoice); }
    public void handleInvoicePaymentFailed(com.stripe.model.Invoice invoice)    { webhookService.handleInvoicePaymentFailed(invoice); }
    public void handleSubscriptionUpdated(Subscription subscription)            { webhookService.handleSubscriptionUpdated(subscription); }
    public void handleSubscriptionDeleted(Subscription subscription)            { webhookService.handleSubscriptionDeleted(subscription); }
    public void handleChargeRefunded(Charge charge)                             { webhookService.handleChargeRefunded(charge); }
    public void handlePaymentActionRequired(PaymentIntent paymentIntent)        { webhookService.handlePaymentActionRequired(paymentIntent); }

    // ── Invoice queries & PDF ─────────────────────────────────────────────────

    public Page<InvoiceResponse> getMyInvoices(UUID userId, Pageable pageable)               { return invoiceService.getMyInvoices(userId, pageable); }
    public Page<InvoiceResponse> listAllInvoices(Pageable pageable)                          { return invoiceService.listAllInvoices(pageable); }
    public Page<InvoiceResponse> listInvoicesByTenant(UUID tenantId, Pageable pageable)      { return invoiceService.listInvoicesByTenant(tenantId, pageable); }
    public InvoiceResponse getInvoiceById(UUID id)                                           { return invoiceService.getInvoiceById(id); }
    public InvoicePdfResult resolveInvoicePdf(UUID invoiceId)                                { return invoiceService.resolveInvoicePdf(invoiceId); }
    public InvoicePdfResult resolveInvoicePdfForUser(UUID invoiceId, UUID userId)            { return invoiceService.resolveInvoicePdfForUser(invoiceId, userId); }
    public void processRefund(UUID invoiceId, String reason)                                 { invoiceService.processRefund(invoiceId, reason); }

    // ── Subscription lifecycle ────────────────────────────────────────────────

    public SubscriptionResponse getSubscription(UUID userId)                                 { return subscriptionService.getSubscription(userId); }
    public SubscriptionResponse getSubscription(UUID userId, UUID tenantId)                  { return subscriptionService.getSubscription(userId, tenantId); }
    public void cancelSubscription(UUID userId)                                              { subscriptionService.cancelSubscription(userId); }
    public void cancelSubscription(UUID userId, UUID tenantId)                               { subscriptionService.cancelSubscription(userId, tenantId); }
    public void changePlan(UUID customerId, String newPriceId)                               { subscriptionService.changePlan(customerId, newPriceId); }
    public void startTrial(UUID userId, UUID tenantId, int trialDays)                        { subscriptionService.startTrial(userId, tenantId, trialDays); }
}
