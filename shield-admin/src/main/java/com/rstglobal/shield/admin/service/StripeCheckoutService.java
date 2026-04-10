package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.config.StripeConfig;
import com.rstglobal.shield.admin.dto.CheckoutResponse;
import com.rstglobal.shield.admin.entity.Invoice;
import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.repository.InvoiceRepository;
import com.rstglobal.shield.admin.repository.SubscriptionPlanRepository;
import com.stripe.model.checkout.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StripeCheckoutService {

    private final StripeService stripeService;
    private final StripeConfig stripeConfig;
    private final InvoiceRepository invoiceRepo;
    private final SubscriptionPlanRepository planRepo;

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
}
