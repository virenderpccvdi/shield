package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateChildProfileRequest;
import com.rstglobal.shield.profile.dto.request.UpdateChildProfileRequest;
import com.rstglobal.shield.profile.dto.response.ChildProfileResponse;
import com.rstglobal.shield.profile.entity.ChildProfile;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import com.rstglobal.shield.profile.service.ChildProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/profiles/children")
@RequiredArgsConstructor
@Tag(name = "Child Profiles", description = "Child profile management")
public class ChildProfileController {

    private final ChildProfileService childProfileService;
    private final CustomerRepository customerRepository;
    private final ChildProfileRepository childProfileRepository;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create child profile", description = "Creates a child profile under the authenticated customer; provisions a DNS client ID for AdGuard filtering.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Child profile created"),
        @ApiResponse(responseCode = "403", description = "Access denied — CUSTOMER role required"),
        @ApiResponse(responseCode = "400", description = "Profile limit reached for this customer")
    })
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
        // GLOBAL_ADMIN and ISP_ADMIN bypass customer ownership check
        if ("GLOBAL_ADMIN".equals(role) || "ISP_ADMIN".equals(role)) {
            return ApiResponse.ok(childProfileService.getByIdAdmin(id));
        }
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
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Profile deleted"),
        @ApiResponse(responseCode = "403", description = "Access denied — not the owner"),
        @ApiResponse(responseCode = "404", description = "Profile not found")
    })
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

    // ── Battery alert settings ────────────────────────────────────────────────

    @GetMapping("/{id}/battery-alerts")
    @Operation(summary = "Get battery alert settings for a child profile")
    public ApiResponse<Map<String, Object>> getBatteryAlerts(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        resolveCustomerId(userId, role);
        ChildProfile profile = childProfileRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("child-profile", id.toString()));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profileId", id);
        body.put("enabled",   profile.isBatteryAlertEnabled());
        body.put("threshold", profile.getBatteryAlertThreshold());
        return ApiResponse.ok(body);
    }

    @PutMapping("/{id}/battery-alerts")
    @Operation(summary = "Update battery alert settings for a child profile")
    public ApiResponse<Map<String, Object>> updateBatteryAlerts(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req) {
        resolveCustomerId(userId, role);
        ChildProfile profile = childProfileRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("child-profile", id.toString()));
        if (req.containsKey("enabled")) {
            profile.setBatteryAlertEnabled(Boolean.TRUE.equals(req.get("enabled")));
        }
        if (req.containsKey("threshold") && req.get("threshold") instanceof Number n) {
            int t = n.intValue();
            profile.setBatteryAlertThreshold(Math.max(5, Math.min(95, t)));
        }
        childProfileRepository.save(profile);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("profileId", id);
        body.put("enabled",   profile.isBatteryAlertEnabled());
        body.put("threshold", profile.getBatteryAlertThreshold());
        return ApiResponse.ok(body);
    }

    private UUID resolveCustomerId(UUID userId, String role) {
        if (!"CUSTOMER".equals(role) && !"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Access denied");
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
