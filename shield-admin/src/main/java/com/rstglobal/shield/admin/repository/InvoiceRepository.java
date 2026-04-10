package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID>,
        JpaSpecificationExecutor<Invoice> {
    Optional<Invoice> findByStripeInvoiceId(String stripeInvoiceId);
    Optional<Invoice> findByStripeCheckoutSessionId(String sessionId);
    Optional<Invoice> findByStripePaymentIntentId(String stripePaymentIntentId);
    Page<Invoice> findByTenantId(UUID tenantId, Pageable pageable);
    Page<Invoice> findByUserId(UUID userId, Pageable pageable);
}
