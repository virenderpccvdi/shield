package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateCustomerRequest;
import com.rstglobal.shield.profile.dto.response.CustomerResponse;
import com.rstglobal.shield.profile.entity.Customer;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final ChildProfileRepository childProfileRepository;

    @Transactional
    public CustomerResponse create(UUID tenantId, CreateCustomerRequest req) {
        if (customerRepository.existsByUserId(req.getUserId())) {
            throw ShieldException.conflict("Customer already exists for user: " + req.getUserId());
        }
        Customer customer = Customer.builder()
                .userId(req.getUserId())
                .subscriptionPlan(req.getSubscriptionPlan() != null ? req.getSubscriptionPlan() : "BASIC")
                .subscriptionStatus("ACTIVE")
                .maxProfiles(req.getMaxProfiles() != null ? req.getMaxProfiles() : 5)
                .build();
        customer.setTenantId(tenantId);
        customer = customerRepository.save(customer);
        log.info("Created customer {} for user {}", customer.getId(), req.getUserId());
        return toResponse(customer);
    }

    public CustomerResponse getById(UUID id) {
        return toResponse(findOrThrow(id));
    }

    public CustomerResponse getByUserId(UUID userId) {
        return toResponse(customerRepository.findByUserId(userId)
                .orElseThrow(() -> ShieldException.notFound("Customer", userId)));
    }

    public PagedResponse<CustomerResponse> listByTenant(UUID tenantId, Pageable pageable) {
        return PagedResponse.of(customerRepository.findByTenantId(tenantId, pageable)
                .map(this::toResponse));
    }

    private Customer findOrThrow(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Customer", id));
    }

    private CustomerResponse toResponse(Customer c) {
        int profileCount = childProfileRepository.countByCustomerId(c.getId());
        return CustomerResponse.builder()
                .id(c.getId())
                .tenantId(c.getTenantId())
                .userId(c.getUserId())
                .subscriptionPlan(c.getSubscriptionPlan())
                .subscriptionStatus(c.getSubscriptionStatus())
                .subscriptionExpiresAt(c.getSubscriptionExpiresAt())
                .maxProfiles(c.getMaxProfiles())
                .profileCount(profileCount)
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
