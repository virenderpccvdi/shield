package com.rstglobal.shield.admin.config;

import com.stripe.Stripe;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
@Getter
@Slf4j
public class StripeConfig {

    @Value("${stripe.secret-key:}")
    private String secretKey;

    @Value("${stripe.publishable-key:}")
    private String publishableKey;

    @Value("${stripe.webhook-secret:}")
    private String webhookSecret;

    @Value("${stripe.success-url:https://shield.rstglobal.in/app/billing/success}")
    private String successUrl;

    @Value("${stripe.cancel-url:https://shield.rstglobal.in/app/billing/cancel}")
    private String cancelUrl;

    @PostConstruct
    public void init() {
        if (secretKey != null && !secretKey.isBlank()) {
            Stripe.apiKey = secretKey;
            log.info("Stripe API initialized");
        } else {
            log.warn("Stripe secret key not configured — billing features disabled");
        }
    }
}
