package com.rstglobal.shield.admin.repository;

import com.rstglobal.shield.admin.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {
    List<PaymentTransaction> findByInvoiceId(UUID invoiceId);
}
