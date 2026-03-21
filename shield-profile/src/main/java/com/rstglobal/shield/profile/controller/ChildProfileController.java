package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateChildProfileRequest;
import com.rstglobal.shield.profile.dto.request.UpdateChildProfileRequest;
import com.rstglobal.shield.profile.dto.response.ChildProfileResponse;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import com.rstglobal.shield.profile.service.ChildProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/profiles/children")
@RequiredArgsConstructor
@Tag(name = "Child Profiles", description = "Child profile management")
public class ChildProfileController {

    private final ChildProfileService childProfileService;
    private final CustomerRepository customerRepository;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create child profile")
    public ApiResponse<ChildProfileResponse> create(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody CreateChildProfileRequest req) {
        UUID tenantId = tenantIdStr != null && !tenantIdStr.isBlank() ? UUID.fromString(tenantIdStr) : null;
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(childProfileService.create(customerId, tenantId, req));
    }

    @GetMapping
    @Operation(summary = "List child profiles for the current customer")
    public ApiResponse<List<ChildProfileResponse>> list(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role) {
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(childProfileService.listByCustomer(customerId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get child profile detail")
    public ApiResponse<ChildProfileResponse> getById(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(childProfileService.getById(id, customerId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update child profile")
    public ApiResponse<ChildProfileResponse> update(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateChildProfileRequest req) {
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(childProfileService.update(id, customerId, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete child profile")
    public void delete(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        UUID customerId = resolveCustomerId(userId, role);
        childProfileService.delete(id, customerId);
    }

    @GetMapping("/{id}/status")
    @Operation(summary = "Get child online status, last seen, and battery level")
    public ApiResponse<java.util.Map<String, Object>> getStatus(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(childProfileService.getChildStatus(id, customerId));
    }

    @GetMapping("/{id}/doh-url")
    @Operation(summary = "Get DNS-over-HTTPS URL for device setup")
    public ApiResponse<String> getDohUrl(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(childProfileService.getDohUrl(id, customerId));
    }

    private UUID resolveCustomerId(UUID userId, String role) {
        if (!"CUSTOMER".equals(role)) {
            throw ShieldException.forbidden("CUSTOMER role required");
        }
        return customerRepository.findByUserId(userId)
                .orElseGet(() -> {
                    // Auto-provision Customer record on first access
                    com.rstglobal.shield.profile.entity.Customer c =
                        com.rstglobal.shield.profile.entity.Customer.builder()
                            .userId(userId)
                            .subscriptionPlan("BASIC")
                            .subscriptionStatus("ACTIVE")
                            .maxProfiles(5)
                            .build();
                    customerRepository.save(c);
                    log.info("Auto-provisioned Customer record for userId={}", userId);
                    return c;
                })
                .getId();
    }
}
