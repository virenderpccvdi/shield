package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateCustomerRequest;
import com.rstglobal.shield.profile.dto.request.UpdateCustomerRequest;
import com.rstglobal.shield.profile.dto.response.CustomerResponse;
import com.rstglobal.shield.profile.entity.Customer;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
                .name(req.getName())
                .email(req.getEmail())
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
        Page<Customer> page = (tenantId == null)
                ? customerRepository.findAll(pageable)
                : customerRepository.findByTenantId(tenantId, pageable);
        // Bulk-fetch profile counts in one query to avoid N+1
        List<UUID> customerIds = page.map(Customer::getId).toList();
        Map<UUID, Integer> countsByCustomer = childProfileRepository.countActiveByCustomerIds(customerIds);
        return PagedResponse.of(page.map(c -> toResponse(c, countsByCustomer.getOrDefault(c.getId(), 0))));
    }

    @Transactional
    public CustomerResponse update(UUID id, UpdateCustomerRequest req, UUID tenantId) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Customer", id));
        // Ensure ISP admin can only manage their own tenant's customers
        if (tenantId != null && !tenantId.equals(customer.getTenantId())) {
            throw ShieldException.forbidden("Customer does not belong to your tenant");
        }
        if (req.getSubscriptionPlan() != null) customer.setSubscriptionPlan(req.getSubscriptionPlan());
        if (req.getSubscriptionStatus() != null) customer.setSubscriptionStatus(req.getSubscriptionStatus());
        if (req.getMaxProfiles() != null) customer.setMaxProfiles(req.getMaxProfiles());
        customer = customerRepository.save(customer);
        log.info("Updated customer {}: plan={}, status={}", id, customer.getSubscriptionPlan(), customer.getSubscriptionStatus());
        return toResponse(customer);
    }

    @Transactional
    public void delete(UUID id, UUID tenantId) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Customer", id));
        if (tenantId != null && !tenantId.equals(customer.getTenantId())) {
            throw ShieldException.forbidden("Customer does not belong to your tenant");
        }
        customerRepository.delete(customer);
        log.info("Deleted customer {}", id);
    }

    private Customer findOrThrow(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Customer", id));
    }

    private CustomerResponse toResponse(Customer c) {
        return toResponse(c, childProfileRepository.countByCustomerIdAndActiveTrue(c.getId()));
    }

    private CustomerResponse toResponse(Customer c, int profileCount) {
        return CustomerResponse.builder()
                .id(c.getId())
                .tenantId(c.getTenantId())
                .userId(c.getUserId())
                .name(c.getName())
                .email(c.getEmail())
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
