package com.rstglobal.shield.admin.controller;

import com.rstglobal.shield.admin.config.StripeConfig;
import com.rstglobal.shield.admin.service.BillingService;
import com.stripe.model.Event;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
public class StripeWebhookController {

    private final StripeConfig stripeConfig;
    private final BillingService billingService;

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {

        Event event;
        if (stripeConfig.getWebhookSecret() != null && !stripeConfig.getWebhookSecret().isBlank() && sigHeader != null) {
            try {
                event = Webhook.constructEvent(payload, sigHeader, stripeConfig.getWebhookSecret());
            } catch (Exception e) {
                log.warn("Invalid Stripe webhook signature: {}", e.getMessage());
                return ResponseEntity.status(400).body("Invalid signature");
            }
        } else {
            // No webhook secret configured — use constructEvent with empty secret (test mode)
            try {
                event = com.stripe.model.Event.GSON.fromJson(payload, com.stripe.model.Event.class);
            } catch (Exception e) {
                log.warn("Failed to parse Stripe event: {}", e.getMessage());
                return ResponseEntity.badRequest().body("Invalid payload");
            }
        }

        log.info("Stripe webhook: type={}, id={}", event.getType(), event.getId());

        try {
            switch (event.getType()) {
                case "checkout.session.completed" -> {
                    Session session = (Session) event.getDataObjectDeserializer()
                            .getObject().orElse(null);
                    if (session != null) billingService.handleCheckoutCompleted(session);
                }
                case "invoice.paid" -> {
                    com.stripe.model.Invoice invoice = (com.stripe.model.Invoice) event.getDataObjectDeserializer()
                            .getObject().orElse(null);
                    if (invoice != null) billingService.handleInvoicePaid(invoice);
                }
                case "invoice.payment_failed" -> {
                    com.stripe.model.Invoice invoice = (com.stripe.model.Invoice) event.getDataObjectDeserializer()
                            .getObject().orElse(null);
                    if (invoice != null) billingService.handleInvoicePaymentFailed(invoice);
                }
                case "customer.subscription.deleted" -> {
                    Subscription sub = (Subscription) event.getDataObjectDeserializer()
                            .getObject().orElse(null);
                    if (sub != null) billingService.handleSubscriptionDeleted(sub);
                }
                default -> log.debug("Unhandled Stripe event type: {}", event.getType());
            }
        } catch (Exception e) {
            log.error("Error processing Stripe webhook {}: {}", event.getType(), e.getMessage(), e);
        }

        return ResponseEntity.ok("received");
    }
}
