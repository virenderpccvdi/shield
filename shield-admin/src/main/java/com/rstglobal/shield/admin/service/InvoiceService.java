package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.InvoicePdfResult;
import com.rstglobal.shield.admin.dto.InvoiceResponse;
import com.rstglobal.shield.admin.entity.Invoice;
import com.rstglobal.shield.admin.repository.InvoiceRepository;
import com.rstglobal.shield.common.exception.ShieldException;
import com.stripe.param.RefundCreateParams;
import com.stripe.model.Refund;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepo;
    private final AuditLogService auditLogService;
    private final NotificationClient notificationClient;
    private final EntityManager entityManager;

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
                .orElseThrow(() -> ShieldException.notFound("Invoice", id));
    }

    /**
     * Resolve invoice PDF: try stored pdfUrl, then Stripe API, then generate HTML.
     */
    public InvoicePdfResult resolveInvoicePdf(UUID invoiceId) {
        Invoice inv = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> ShieldException.notFound("Invoice", invoiceId));

        if (inv.getPdfUrl() != null && !inv.getPdfUrl().isBlank()) {
            return InvoicePdfResult.redirect(inv.getPdfUrl());
        }

        if (inv.getStripeInvoiceId() != null && !inv.getStripeInvoiceId().isBlank()) {
            try {
                com.stripe.model.Invoice stripeInvoice =
                        com.stripe.model.Invoice.retrieve(inv.getStripeInvoiceId());
                String stripePdf = stripeInvoice.getInvoicePdf();
                if (stripePdf != null && !stripePdf.isBlank()) {
                    inv.setPdfUrl(stripePdf);
                    invoiceRepo.save(inv);
                    return InvoicePdfResult.redirect(stripePdf);
                }
            } catch (Exception e) {
                log.warn("Failed to fetch Stripe invoice PDF for {}: {}", inv.getStripeInvoiceId(), e.getMessage());
            }
        }

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

    /**
     * Process a refund for a paid invoice.
     */
    @Transactional
    public void processRefund(UUID invoiceId, String reason) {
        Invoice invoice = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> ShieldException.notFound("Invoice", invoiceId));
        if (!"PAID".equals(invoice.getStatus())) {
            throw ShieldException.badRequest("Only paid invoices can be refunded");
        }

        if (invoice.getStripePaymentIntentId() != null && !invoice.getStripePaymentIntentId().isBlank()) {
            try {
                RefundCreateParams params = RefundCreateParams.builder()
                        .setPaymentIntent(invoice.getStripePaymentIntentId())
                        .setReason(mapRefundReason(reason))
                        .build();
                Refund.create(params);
                log.info("Stripe refund created for paymentIntent={}, invoiceId={}", invoice.getStripePaymentIntentId(), invoiceId);
            } catch (Exception e) {
                log.error("Failed to create Stripe refund for invoice {}: {}", invoiceId, e.getMessage(), e);
                throw new RuntimeException("Failed to process Stripe refund: " + e.getMessage(), e);
            }
        } else {
            log.warn("No Stripe paymentIntentId on invoice {} — marking REFUNDED locally only", invoiceId);
        }

        invoice.setStatus("REFUNDED");
        invoiceRepo.save(invoice);

        auditLogService.log("PAYMENT_REFUNDED", "Invoice", invoiceId.toString(),
                invoice.getUserId(), invoice.getUserEmail(), null,
                java.util.Map.of("reason", reason != null ? reason : "admin_initiated"));

        notificationClient.sendRefundNotificationEmail(
                invoice.getUserEmail(), null, invoice.getStripeInvoiceId() != null
                        ? invoice.getStripeInvoiceId() : invoiceId.toString(),
                invoice.getAmount(), invoice.getCurrency(), invoice.getTenantId());

        log.info("Invoice {} marked REFUNDED (reason={})", invoiceId, reason);
    }

    private RefundCreateParams.Reason mapRefundReason(String reason) {
        if (reason == null) return RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER;
        return switch (reason.toLowerCase()) {
            case "duplicate"  -> RefundCreateParams.Reason.DUPLICATE;
            case "fraudulent" -> RefundCreateParams.Reason.FRAUDULENT;
            default           -> RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER;
        };
    }

    private InvoiceResponse toResponse(Invoice inv) {
        String tenantName = null;
        if (inv.getTenantId() != null) {
            try {
                tenantName = (String) entityManager.createNativeQuery(
                        "SELECT name FROM tenant.tenants WHERE id = :tid")
                        .setParameter("tid", inv.getTenantId()).getSingleResult();
            } catch (Exception ignored) {}
        }
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
}
