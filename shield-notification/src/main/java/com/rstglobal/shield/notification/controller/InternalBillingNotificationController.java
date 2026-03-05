package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.dto.request.InvoiceEmailRequest;
import com.rstglobal.shield.notification.dto.request.SubscriptionEmailRequest;
import com.rstglobal.shield.notification.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Internal endpoints called by shield-admin (billing) to send
 * invoice and subscription confirmation emails.
 * Not exposed through the API gateway.
 */
@Slf4j
@RestController
@RequestMapping("/internal/notifications/billing")
@RequiredArgsConstructor
public class InternalBillingNotificationController {

    private final EmailService emailService;

    @PostMapping("/invoice-paid")
    public ResponseEntity<ApiResponse<Boolean>> sendInvoiceEmail(
            @Valid @RequestBody InvoiceEmailRequest req) {

        log.info("Sending invoice email to {} for invoice {}", req.getEmail(), req.getInvoiceNumber());

        Map<String, Object> vars = new HashMap<>();
        vars.put("name", req.getName());
        vars.put("invoiceNumber", req.getInvoiceNumber());
        vars.put("planName", req.getPlanName());
        vars.put("amount", req.getAmount());
        vars.put("currency", req.getCurrency() != null ? req.getCurrency() : "INR");
        vars.put("billingPeriodStart", req.getBillingPeriodStart() != null ? req.getBillingPeriodStart() : "—");
        vars.put("billingPeriodEnd", req.getBillingPeriodEnd() != null ? req.getBillingPeriodEnd() : "—");
        vars.put("invoiceDate", req.getInvoiceDate() != null ? req.getInvoiceDate() : java.time.LocalDate.now().toString());
        vars.put("dashboardUrl", req.getDashboardUrl() != null ? req.getDashboardUrl() : "https://shield.rstglobal.in/app/billing");

        boolean sent = emailService.sendEmail(
                req.getTenantId(),
                req.getEmail(),
                "Invoice #" + req.getInvoiceNumber() + " — Shield Payment Receipt",
                "email/invoice",
                vars
        );

        return ResponseEntity.ok(ApiResponse.ok(sent));
    }

    @PostMapping("/subscription-confirmed")
    public ResponseEntity<ApiResponse<Boolean>> sendSubscriptionEmail(
            @Valid @RequestBody SubscriptionEmailRequest req) {

        log.info("Sending subscription confirmation email to {} for plan {}", req.getEmail(), req.getPlanName());

        Map<String, Object> vars = new HashMap<>();
        vars.put("name", req.getName());
        vars.put("planName", req.getPlanName());
        vars.put("features", req.getFeatures());
        vars.put("maxProfiles", req.getMaxProfiles());
        vars.put("dashboardUrl", req.getDashboardUrl() != null ? req.getDashboardUrl() : "https://shield.rstglobal.in/app/");

        boolean sent = emailService.sendEmail(
                req.getTenantId(),
                req.getEmail(),
                "Welcome to Shield " + req.getPlanName() + " — Subscription Confirmed",
                "email/subscription-confirmed",
                vars
        );

        return ResponseEntity.ok(ApiResponse.ok(sent));
    }
}
