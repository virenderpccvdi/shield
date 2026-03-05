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

    private String resolveBaseUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(SERVICE_ID);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka — skipping notification", SERVICE_ID);
            return null;
        }
        return instances.get(0).getUri().toString();
    }
}
