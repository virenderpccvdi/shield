package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateChildProfileRequest;
import com.rstglobal.shield.profile.dto.request.CreateCustomerRequest;
import com.rstglobal.shield.profile.dto.request.UpdateCustomerRequest;
import com.rstglobal.shield.profile.dto.response.ChildProfileResponse;
import com.rstglobal.shield.profile.dto.response.CustomerResponse;
import com.rstglobal.shield.profile.service.ChildProfileService;
import com.rstglobal.shield.profile.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Customer account management")
public class CustomerController {

    private final CustomerService customerService;
    private final ChildProfileService childProfileService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create customer account (ISP_ADMIN only)")
    public ApiResponse<CustomerResponse> create(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @Valid @RequestBody CreateCustomerRequest req) {
        requireIspAdmin(role);
        return ApiResponse.ok(customerService.create(parseUuid(tenantIdStr), req));
    }

    @GetMapping
    @Operation(summary = "List customers for tenant (ISP_ADMIN only)")
    public ApiResponse<PagedResponse<CustomerResponse>> list(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        requireIspAdmin(role);
        return ApiResponse.ok(customerService.listByTenant(parseUuid(tenantIdStr),
                PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get customer by ID")
    public ApiResponse<CustomerResponse> getById(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireIspAdmin(role);
        return ApiResponse.ok(customerService.getById(id));
    }

    @GetMapping("/me")
    @Operation(summary = "Get own customer account (CUSTOMER role)")
    public ApiResponse<CustomerResponse> getMe(
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.ok(customerService.getByUserId(userId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update customer (ISP_ADMIN only)")
    public ApiResponse<CustomerResponse> update(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id,
            @RequestBody UpdateCustomerRequest req) {
        requireIspAdmin(role);
        return ApiResponse.ok(customerService.update(id, req, parseUuid(tenantIdStr)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete customer (ISP_ADMIN only)")
    public void delete(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID id) {
        requireIspAdmin(role);
        customerService.delete(id, parseUuid(tenantIdStr));
    }

    @GetMapping("/{customerId}/children")
    @Operation(summary = "List child profiles for a customer (ISP_ADMIN only)")
    public ApiResponse<List<ChildProfileResponse>> getCustomerChildren(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID customerId) {
        requireIspAdmin(role);
        UUID tenantId = parseUuid(tenantIdStr);
        // Verify customer belongs to tenant
        CustomerResponse cust = customerService.getById(customerId);
        if (tenantId != null && !tenantId.equals(cust.getTenantId())) {
            throw ShieldException.forbidden("Customer does not belong to your tenant");
        }
        return ApiResponse.ok(childProfileService.listByCustomer(customerId));
    }

    @PostMapping("/{customerId}/children")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create child profile for a customer (ISP_ADMIN only)")
    public ApiResponse<ChildProfileResponse> createChildProfile(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID customerId,
            @Valid @RequestBody CreateChildProfileRequest req) {
        requireIspAdmin(role);
        UUID tenantId = parseUuid(tenantIdStr);
        // Verify customer belongs to tenant (unless GLOBAL_ADMIN with no tenant)
        CustomerResponse cust = customerService.getById(customerId);
        if (tenantId != null && !tenantId.equals(cust.getTenantId())) {
            throw ShieldException.forbidden("Customer does not belong to your tenant");
        }
        UUID effectiveTenantId = tenantId != null ? tenantId : cust.getTenantId();
        return ApiResponse.ok(childProfileService.create(customerId, effectiveTenantId, req));
    }

    @DeleteMapping("/{customerId}/children/{profileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete child profile (ISP_ADMIN only)")
    public void deleteChildProfile(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @PathVariable UUID customerId,
            @PathVariable UUID profileId) {
        requireIspAdmin(role);
        UUID tenantId = parseUuid(tenantIdStr);
        CustomerResponse cust = customerService.getById(customerId);
        if (tenantId != null && !tenantId.equals(cust.getTenantId())) {
            throw ShieldException.forbidden("Customer does not belong to your tenant");
        }
        childProfileService.deleteAdmin(profileId);
    }

    private void requireIspAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN role required");
        }
    }

    private static UUID parseUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (IllegalArgumentException e) { return null; }
    }
}
