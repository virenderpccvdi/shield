package com.rstglobal.shield.admin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Async client that calls shield-notification internal endpoints
 * for billing-related email notifications.
 *
 * Uses Eureka DiscoveryClient to resolve SHIELD-NOTIFICATION.
 * Fire-and-forget: logs errors but never fails the billing flow.
 */
@Slf4j
@Service
public class NotificationClient {

    private static final String SERVICE_ID = "SHIELD-NOTIFICATION";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM d, yyyy");

    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public NotificationClient(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Send invoice-paid email (async — does not block billing flow).
     */
    @Async
    public void sendInvoicePaidEmail(String email, String name, String invoiceNumber,
                                      String planName, BigDecimal amount, String currency,
                                      OffsetDateTime billingStart, OffsetDateTime billingEnd,
                                      java.util.UUID tenantId) {
        try {
            String baseUrl = resolveBaseUrl();
            if (baseUrl == null) return;

            Map<String, Object> body = Map.ofEntries(
                    Map.entry("email", email),
                    Map.entry("name", name != null ? name : email),
                    Map.entry("invoiceNumber", invoiceNumber),
                    Map.entry("planName", planName),
                    Map.entry("amount", amount.toPlainString()),
                    Map.entry("currency", currency != null ? currency : "INR"),
                    Map.entry("billingPeriodStart", billingStart != null ? billingStart.format(DATE_FMT) : ""),
                    Map.entry("billingPeriodEnd", billingEnd != null ? billingEnd.format(DATE_FMT) : ""),
                    Map.entry("dashboardUrl", "https://shield.rstglobal.in/app/billing")
            );

            // Add tenantId only if non-null (Map.of doesn't allow null values)
            java.util.Map<String, Object> payload = new java.util.HashMap<>(body);
            if (tenantId != null) payload.put("tenantId", tenantId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/billing/invoice-paid")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Invoice email request sent for {}", invoiceNumber);
        } catch (Exception e) {
            log.warn("Failed to send invoice email for {}: {}", invoiceNumber, e.getMessage());
        }
    }

    /**
     * Send subscription-confirmed email (async — does not block billing flow).
     */
    @Async
    public void sendSubscriptionConfirmedEmail(String email, String name, String planName,
                                                List<String> features, int maxProfiles,
                                                java.util.UUID tenantId) {
        try {
            String baseUrl = resolveBaseUrl();
            if (baseUrl == null) return;

            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("email", email);
            payload.put("name", name != null ? name : email);
            payload.put("planName", planName);
            payload.put("maxProfiles", maxProfiles);
            payload.put("dashboardUrl", "https://shield.rstglobal.in/app/");
            if (features != null) payload.put("features", features);
            if (tenantId != null) payload.put("tenantId", tenantId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/billing/subscription-confirmed")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Subscription confirmation email request sent for {} (plan={})", email, planName);
        } catch (Exception e) {
            log.warn("Failed to send subscription confirmation email to {}: {}", email, e.getMessage());
        }
    }

    /**
     * Send payment-failed notification email with dunning context (async).
     */
    @Async
    public void sendPaymentFailedEmail(String email, String name, String invoiceId,
                                        BigDecimal amount, String currency,
                                        int attemptNumber, java.time.Instant nextRetryDate,
                                        java.util.UUID tenantId) {
        try {
            String baseUrl = resolveBaseUrl();
            if (baseUrl == null) return;

            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("email", email);
            payload.put("name", name != null ? name : email);
            payload.put("invoiceId", invoiceId);
            payload.put("amount", amount != null ? amount.toPlainString() : "0");
            payload.put("currency", currency != null ? currency : "INR");
            payload.put("attemptNumber", attemptNumber);
            payload.put("updatePaymentUrl", "https://shield.rstglobal.in/app/billing");
            if (nextRetryDate != null) {
                payload.put("nextRetryDate", java.time.OffsetDateTime.ofInstant(nextRetryDate,
                        java.time.ZoneOffset.UTC).format(DATE_FMT));
            }
            if (tenantId != null) payload.put("tenantId", tenantId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/billing/payment-failed")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Payment-failed email request sent for invoice {} (attempt {})", invoiceId, attemptNumber);
        } catch (Exception e) {
            log.warn("Failed to send payment-failed email for {}: {}", invoiceId, e.getMessage());
        }
    }

    /**
     * Backward-compatible overload (no dunning info) — used by legacy callers.
     */
    @Async
    public void sendPaymentFailedEmail(String email, String name, String invoiceId,
                                        BigDecimal amount, String currency,
                                        java.util.UUID tenantId) {
        sendPaymentFailedEmail(email, name, invoiceId, amount, currency, 1, null, tenantId);
    }

    /**
     * Send refund notification email (async).
     */
    @Async
    public void sendRefundNotificationEmail(String email, String name, String invoiceReference,
                                             BigDecimal amount, String currency,
                                             java.util.UUID tenantId) {
        try {
            String baseUrl = resolveBaseUrl();
            if (baseUrl == null) return;

            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("email", email);
            payload.put("name", name != null ? name : email);
            payload.put("invoiceReference", invoiceReference);
            payload.put("amount", amount != null ? amount.toPlainString() : "0");
            payload.put("currency", currency != null ? currency : "INR");
            payload.put("dashboardUrl", "https://shield.rstglobal.in/app/billing");
            if (tenantId != null) payload.put("tenantId", tenantId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/billing/refund-issued")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Refund notification email sent for invoice {}", invoiceReference);
        } catch (Exception e) {
            log.warn("Failed to send refund notification email for {}: {}", invoiceReference, e.getMessage());
        }
    }

    /**
     * Send subscription renewal reminder email (async).
     */
    @Async
    public void sendRenewalReminderEmail(String email, String name, String planName,
                                          BigDecimal amount, String currency,
                                          java.time.Instant renewalDate,
                                          java.util.UUID tenantId) {
        try {
            String baseUrl = resolveBaseUrl();
            if (baseUrl == null) return;

            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("email", email);
            payload.put("name", name != null ? name : email);
            payload.put("planName", planName);
            payload.put("amount", amount != null ? amount.toPlainString() : "0");
            payload.put("currency", currency != null ? currency : "INR");
            payload.put("dashboardUrl", "https://shield.rstglobal.in/app/billing");
            if (renewalDate != null) {
                payload.put("renewalDate", java.time.OffsetDateTime.ofInstant(renewalDate,
                        java.time.ZoneOffset.UTC).format(DATE_FMT));
            }
            if (tenantId != null) payload.put("tenantId", tenantId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/billing/renewal-reminder")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Renewal reminder email sent to {} for plan {}", email, planName);
        } catch (Exception e) {
            log.warn("Failed to send renewal reminder email to {}: {}", email, e.getMessage());
        }
    }

    /**
     * Send payment-action-required notification email (async).
     */
    @Async
    public void sendPaymentActionRequiredEmail(String email, String name,
                                                String paymentIntentId,
                                                java.util.UUID tenantId) {
        try {
            String baseUrl = resolveBaseUrl();
            if (baseUrl == null) return;

            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("email", email);
            payload.put("name", name != null ? name : email);
            payload.put("paymentIntentId", paymentIntentId);
            payload.put("actionUrl", "https://shield.rstglobal.in/app/billing");
            if (tenantId != null) payload.put("tenantId", tenantId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/billing/payment-action-required")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Payment-action-required email sent for paymentIntent {}", paymentIntentId);
        } catch (Exception e) {
            log.warn("Failed to send payment-action-required email: {}", e.getMessage());
        }
    }

    private String resolveBaseUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(SERVICE_ID);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka — skipping notification", SERVICE_ID);
            return null;
        }
        return instances.get(0).getUri().toString();
    }
}
