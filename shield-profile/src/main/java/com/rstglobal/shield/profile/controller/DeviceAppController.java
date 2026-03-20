package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.SyncAppsRequest;
import com.rstglobal.shield.profile.dto.request.UpdateAppControlRequest;
import com.rstglobal.shield.profile.dto.response.DeviceAppResponse;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.service.DeviceAppService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/apps")
@RequiredArgsConstructor
@Tag(name = "Device Apps", description = "Child device app management and control")
public class DeviceAppController {

    private final DeviceAppService appService;
    private final CustomerRepository customerRepository;
    private final ChildProfileRepository childProfileRepository;

    /** Called by the child app to sync installed apps + usage */
    @PostMapping("/sync")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Sync installed apps from child device")
    public void syncApps(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody SyncAppsRequest req) {
        // Allow child app (has profileId in auth) or CUSTOMER
        appService.syncApps(req);
    }

    /** Parent views installed apps on child's device */
    @GetMapping("/{profileId}")
    @Operation(summary = "List apps installed on child's device")
    public ApiResponse<List<DeviceAppResponse>> listApps(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "false") boolean blockedOnly,
            @RequestParam(defaultValue = "false") boolean excludeSystem) {
        verifyAccess(userId, role, profileId);
        List<DeviceAppResponse> apps = blockedOnly
                ? appService.getBlockedApps(profileId)
                : appService.getAppsForProfile(profileId);
        if (excludeSystem) {
            apps = apps.stream().filter(a -> !a.isSystemApp()).toList();
        }
        return ApiResponse.ok(apps);
    }

    /** Parent blocks/unblocks an app or sets time limit */
    @PatchMapping("/{profileId}/{packageName}")
    @Operation(summary = "Block/unblock app or set time limit")
    public ApiResponse<DeviceAppResponse> updateControl(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID profileId,
            @PathVariable String packageName,
            @RequestBody UpdateAppControlRequest req) {
        verifyAccess(userId, role, profileId);
        return ApiResponse.ok(appService.updateAppControl(profileId, packageName, req));
    }

    /** Parent sets or updates the uninstall protection PIN */
    @PostMapping("/uninstall-pin")
    @Operation(summary = "Set uninstall protection PIN (parent only)")
    public ApiResponse<Map<String, String>> setUninstallPin(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @RequestBody Map<String, String> body) {
        if (!"CUSTOMER".equals(role)) throw ShieldException.forbidden("CUSTOMER role required");
        String pin = body.get("pin");
        if (pin == null || !pin.matches("\\d{4,6}")) {
            throw ShieldException.badRequest("PIN must be 4-6 digits");
        }
        customerRepository.findByUserId(userId).ifPresent(c -> {
            c.setUninstallPin(pin);
            customerRepository.save(c);
        });
        return ApiResponse.ok(Map.of("message", "Uninstall protection PIN set successfully"));
    }

    /** Child app verifies uninstall PIN before allowing uninstall */
    @PostMapping("/verify-uninstall-pin")
    @Operation(summary = "Verify uninstall PIN (called by child app)")
    public ApiResponse<Map<String, Boolean>> verifyUninstallPin(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody Map<String, String> body) {
        String pin = body.get("pin");
        String profileId = body.get("profileId");
        if (pin == null || profileId == null) throw ShieldException.badRequest("pin and profileId required");

        // Find customer for this profile
        boolean valid = childProfileRepository.findById(UUID.fromString(profileId))
                .flatMap(p -> customerRepository.findById(p.getCustomerId()))
                .map(c -> pin.equals(c.getUninstallPin()))
                .orElse(false);
        return ApiResponse.ok(Map.of("valid", valid));
    }

    private void verifyAccess(UUID userId, String role, UUID profileId) {
        if ("GLOBAL_ADMIN".equals(role) || "ISP_ADMIN".equals(role)) return;
        if (!"CUSTOMER".equals(role)) throw ShieldException.forbidden("CUSTOMER role required");
        UUID customerId = customerRepository.findByUserId(userId)
                .orElseThrow(() -> ShieldException.notFound("Customer", userId))
                .getId();
        childProfileRepository.findById(profileId).ifPresent(p -> {
            if (!p.getCustomerId().equals(customerId))
                throw ShieldException.forbidden("Access denied to this profile");
        });
    }
}
