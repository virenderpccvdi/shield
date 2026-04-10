package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.config.StripeConfig;
import com.rstglobal.shield.admin.entity.StripeCustomer;
import com.rstglobal.shield.admin.entity.SubscriptionPlan;
import com.rstglobal.shield.admin.repository.StripeCustomerRepository;
import com.rstglobal.shield.admin.repository.SubscriptionPlanRepository;
import com.stripe.model.Customer;
import com.stripe.model.Price;
import com.stripe.model.Product;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.ProductCreateParams;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.checkout.SessionCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StripeService {

    private final StripeConfig stripeConfig;
    private final StripeCustomerRepository stripeCustomerRepo;
    private final SubscriptionPlanRepository planRepo;

    @Value("${shield.billing.currency:inr}")
    private String defaultCurrency;

    public String getOrCreateStripeCustomer(UUID userId, UUID tenantId, String email, String name) {
        return stripeCustomerRepo.findByUserId(userId)
                .map(StripeCustomer::getStripeCustomerId)
                .orElseGet(() -> {
                    try {
                        CustomerCreateParams params = CustomerCreateParams.builder()
                                .setEmail(email)
                                .setName(name)
                                .putMetadata("shield_user_id", userId.toString())
                                .putMetadata("shield_tenant_id", tenantId != null ? tenantId.toString() : "")
                                .build();
                        Customer customer = Customer.create(params);
                        stripeCustomerRepo.save(StripeCustomer.builder()
                                .userId(userId).tenantId(tenantId)
                                .stripeCustomerId(customer.getId())
                                .email(email).build());
                        log.info("Created Stripe customer {} for user {}", customer.getId(), userId);
                        return customer.getId();
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to create Stripe customer", e);
                    }
                });
    }

    public Session createCheckoutSession(String stripeCustomerId, SubscriptionPlan plan, UUID userId) {
        try {
            String currency = defaultCurrency != null ? defaultCurrency.toLowerCase() : "inr";

            SessionCreateParams.Builder builder = SessionCreateParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setSuccessUrl(stripeConfig.getSuccessUrl())
                    .setCancelUrl(stripeConfig.getCancelUrl())
                    .putMetadata("shield_user_id", userId.toString())
                    .putMetadata("shield_plan_id", plan.getId().toString())
                    .putMetadata("shield_plan_name", plan.getName());

            // Use Stripe automatic payment methods — includes UPI for INR, card everywhere.
            // PaymentMethodType.UPI was removed in stripe-java 28.x; automatic detection
            // is the recommended approach for multi-method support.
            builder.setPaymentMethodConfiguration(null);
            builder.addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD);

            if (plan.getStripePriceId() != null && !plan.getStripePriceId().isBlank()) {
                builder.addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(plan.getStripePriceId())
                        .setQuantity(1L).build());
            } else {
                // Create inline price if no Stripe price ID configured
                builder.addLineItem(SessionCreateParams.LineItem.builder()
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency)
                                .setUnitAmount(plan.getPrice().multiply(BigDecimal.valueOf(100)).longValue())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Shield " + plan.getDisplayName() + " Plan")
                                        .setDescription(plan.getDescription())
                                        .build())
                                .setRecurring(SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                        .setInterval(plan.getBillingCycle().equalsIgnoreCase("YEARLY")
                                                ? SessionCreateParams.LineItem.PriceData.Recurring.Interval.YEAR
                                                : SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH)
                                        .build())
                                .build())
                        .setQuantity(1L).build());
            }

            Session session = Session.create(builder.build());
            log.info("Created checkout session {} for plan {} user {} currency={}", session.getId(), plan.getName(), userId, currency);
            return session;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create checkout session", e);
        }
    }

    public Subscription cancelSubscription(String stripeSubscriptionId) {
        try {
            Subscription sub = Subscription.retrieve(stripeSubscriptionId);
            return sub.cancel();
        } catch (Exception e) {
            throw new RuntimeException("Failed to cancel subscription", e);
        }
    }

    public Subscription changePlan(String stripeSubscriptionId, String newStripePriceId) {
        try {
            Subscription sub = Subscription.retrieve(stripeSubscriptionId);
            String itemId = sub.getItems().getData().get(0).getId();
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .addItem(SubscriptionUpdateParams.Item.builder()
                            .setId(itemId)
                            .setPrice(newStripePriceId)
                            .build())
                    .setProrationBehavior(SubscriptionUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                    .build();
            return sub.update(params);
        } catch (Exception e) {
            throw new RuntimeException("Failed to change plan", e);
        }
    }

    @Transactional
    public void syncPlanToStripe(UUID planId) {
        SubscriptionPlan plan = planRepo.findById(planId)
                .orElseThrow(() -> new RuntimeException("Plan not found: " + planId));
        try {
            // Create or find product
            String productId = plan.getStripeProductId();
            if (productId == null || productId.isBlank()) {
                Product product = Product.create(ProductCreateParams.builder()
                        .setName("Shield " + plan.getDisplayName() + " Plan")
                        .setDescription(plan.getDescription())
                        .putMetadata("shield_plan_id", plan.getId().toString())
                        .build());
                productId = product.getId();
                plan.setStripeProductId(productId);
            }

            // Create price
            String currency = defaultCurrency != null ? defaultCurrency.toLowerCase() : "inr";
            Price price = Price.create(PriceCreateParams.builder()
                    .setProduct(productId)
                    .setCurrency(currency)
                    .setUnitAmount(plan.getPrice().multiply(BigDecimal.valueOf(100)).longValue())
                    .setRecurring(PriceCreateParams.Recurring.builder()
                            .setInterval(plan.getBillingCycle().equalsIgnoreCase("YEARLY")
                                    ? PriceCreateParams.Recurring.Interval.YEAR
                                    : PriceCreateParams.Recurring.Interval.MONTH)
                            .build())
                    .build());
            plan.setStripePriceId(price.getId());
            planRepo.save(plan);
            log.info("Synced plan {} to Stripe: product={}, price={}", plan.getName(), productId, price.getId());
        } catch (Exception e) {
            throw new RuntimeException("Failed to sync plan to Stripe", e);
        }
    }
}
