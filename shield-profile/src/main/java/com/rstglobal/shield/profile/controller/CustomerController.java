package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.dto.PagedResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateCustomerRequest;
import com.rstglobal.shield.profile.dto.response.CustomerResponse;
import com.rstglobal.shield.profile.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/customers")
@RequiredArgsConstructor
@Tag(name = "Customers", description = "Customer account management")
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create customer account (ISP_ADMIN only)")
    public ApiResponse<CustomerResponse> create(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @Valid @RequestBody CreateCustomerRequest req) {
        requireIspAdmin(role);
        return ApiResponse.ok(customerService.create(tenantId, req));
    }

    @GetMapping
    @Operation(summary = "List customers for tenant (ISP_ADMIN only)")
    public ApiResponse<PagedResponse<CustomerResponse>> list(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        requireIspAdmin(role);
        return ApiResponse.ok(customerService.listByTenant(tenantId,
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

    private void requireIspAdmin(String role) {
        if (!"ISP_ADMIN".equals(role) && !"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("ISP_ADMIN role required");
        }
    }
}
