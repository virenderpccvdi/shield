package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateDeviceRequest;
import com.rstglobal.shield.profile.dto.response.DeviceResponse;
import com.rstglobal.shield.profile.entity.Device;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import com.rstglobal.shield.profile.repository.DeviceRepository;
import com.rstglobal.shield.profile.service.DeviceService;
import com.rstglobal.shield.profile.entity.ChildProfile;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/devices")
@RequiredArgsConstructor
@Tag(name = "Devices", description = "Device registration management")
public class DeviceController {

    private final DeviceService deviceService;
    private final DeviceRepository deviceRepository;
    private final CustomerRepository customerRepository;
    private final ChildProfileRepository childProfileRepository;

    @Value("${shield.app.domain:shield.rstglobal.in}")
    private String appDomain;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register device to a child profile")
    public ApiResponse<DeviceResponse> register(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantIdStr,
            @RequestHeader("X-User-Role") String role,
            @Valid @RequestBody CreateDeviceRequest req) {
        UUID customerId = resolveCustomerId(userId, role);
        UUID tenantId = null;
        if (tenantIdStr != null && !tenantIdStr.isBlank()) {
            try { tenantId = UUID.fromString(tenantIdStr); } catch (Exception ignored) {}
        }
        if (tenantId == null) {
            tenantId = customerRepository.findByUserId(userId)
                    .map(c -> c.getTenantId()).orElse(null);
        }
        return ApiResponse.ok(deviceService.register(tenantId, customerId, req));
    }

    @PostMapping("/heartbeat")
    @Operation(summary = "Update heartbeat for all devices of a child profile (called by child app)")
    public ResponseEntity<Void> heartbeat(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody Map<String, String> body) {
        String profileIdStr = body.get("profileId");
        if (profileIdStr == null || profileIdStr.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            Integer batteryPct = body.get("batteryPct") != null ? Integer.parseInt(body.get("batteryPct")) : null;
            java.math.BigDecimal speedKmh = body.get("speedKmh") != null ? new java.math.BigDecimal(body.get("speedKmh")) : null;
            String appVersion = body.get("appVersion");
            deviceService.heartbeatByProfile(UUID.fromString(profileIdStr), batteryPct, speedKmh, appVersion);
        } catch (Exception ignored) {}
        return ResponseEntity.ok().build();
    }

    @GetMapping("/profile/{profileId}")
    @Operation(summary = "List devices for a child profile")
    public ApiResponse<List<DeviceResponse>> listByProfile(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId,
            @PathVariable UUID profileId) {
        if ("ISP_ADMIN".equals(role) || "GLOBAL_ADMIN".equals(role)) {
            // Admin can view any profile's devices
            return ApiResponse.ok(deviceService.listByProfileAdmin(profileId));
        }
        UUID customerId = resolveCustomerId(userId, role);
        return ApiResponse.ok(deviceService.listByProfile(profileId, customerId));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a registered device")
    public void delete(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        if ("ISP_ADMIN".equals(role) || "GLOBAL_ADMIN".equals(role)) {
            deviceService.deleteAdmin(id);
            return;
        }
        UUID customerId = resolveCustomerId(userId, role);
        deviceService.delete(id, customerId);
    }

    @GetMapping("/all")
    @Operation(summary = "List all devices (GLOBAL_ADMIN) or tenant devices (ISP_ADMIN)")
    public ApiResponse<Page<DeviceResponse>> listAll(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        if (!"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Admin role required");
        }
        PageRequest pr = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Device> devices = (tenantId != null && "ISP_ADMIN".equals(role))
                ? deviceRepository.findByTenantId(tenantId, pr)
                : deviceRepository.findAll(pr);
        return ApiResponse.ok(devices.map(d -> DeviceResponse.builder()
                .id(d.getId()).profileId(d.getProfileId()).tenantId(d.getTenantId())
                .name(d.getName()).deviceType(d.getDeviceType()).macAddress(d.getMacAddress())
                .online(d.isOnline()).lastSeenAt(d.getLastSeenAt()).dnsMethod(d.getDnsMethod())
                .createdAt(d.getCreatedAt()).build()));
    }

    @GetMapping("/qr/{childId}")
    @Operation(summary = "Generate QR code data for Private DNS setup on a child device")
    public ApiResponse<Map<String, Object>> getQrSetupData(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID childId) {
        // Allow CUSTOMER (parent) or admins
        if (!"CUSTOMER".equals(role) && !"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Access denied");
        }
        ChildProfile profile = childProfileRepository.findById(childId)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", childId));

        // If CUSTOMER, verify ownership
        if ("CUSTOMER".equals(role)) {
            UUID customerId = customerRepository.findByUserId(userId)
                    .orElseThrow(() -> ShieldException.notFound("Customer", userId))
                    .getId();
            if (!profile.getCustomerId().equals(customerId)) {
                throw ShieldException.forbidden("Access denied to this profile");
            }
        }

        String dohUrl = "https://" + profile.getDnsClientId() + ".dns." + appDomain + "/dns-query";
        Map<String, Object> qrData = new LinkedHashMap<>();
        qrData.put("profileId", childId);
        qrData.put("profileName", profile.getName());
        qrData.put("dnsClientId", profile.getDnsClientId());
        qrData.put("dohUrl", dohUrl);
        qrData.put("setupInstructions", List.of(
                "1. Open Settings on the child's Android device",
                "2. Go to Network & Internet > Private DNS",
                "3. Select 'Private DNS provider hostname'",
                "4. Enter: " + profile.getDnsClientId() + ".dns." + appDomain,
                "5. Tap Save. Shield DNS filtering is now active."
        ));
        qrData.put("qrContent", dohUrl);
        return ApiResponse.ok(qrData);
    }

    @GetMapping(value = "/qr/{childId}/image", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Generate a QR code PNG image for Private DNS device setup")
    public ResponseEntity<byte[]> getQrImage(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID childId,
            @RequestParam(defaultValue = "300") int size) {
        // Allow CUSTOMER (parent) or admins
        if (!"CUSTOMER".equals(role) && !"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Access denied");
        }
        ChildProfile profile = childProfileRepository.findById(childId)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", childId));

        // If CUSTOMER, verify ownership
        if ("CUSTOMER".equals(role)) {
            UUID customerId = customerRepository.findByUserId(userId)
                    .orElseThrow(() -> ShieldException.notFound("Customer", userId))
                    .getId();
            if (!profile.getCustomerId().equals(customerId)) {
                throw ShieldException.forbidden("Access denied to this profile");
            }
        }

        // Build QR content as JSON
        String dohUrl = "https://" + profile.getDnsClientId() + ".dns." + appDomain + "/dns-query";
        String hostname = profile.getDnsClientId() + ".dns." + appDomain;
        String qrContent = "{\"profileId\":\"" + childId + "\","
                + "\"profileName\":\"" + profile.getName().replace("\"", "\\\"") + "\","
                + "\"dnsClientId\":\"" + profile.getDnsClientId() + "\","
                + "\"dohUrl\":\"" + dohUrl + "\","
                + "\"privateDnsHostname\":\"" + hostname + "\","
                + "\"setup\":\"Settings > Network > Private DNS > " + hostname + "\"}";

        try {
            int qrSize = Math.max(150, Math.min(size, 1000));
            QRCodeWriter writer = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = Map.of(
                    EncodeHintType.MARGIN, 1,
                    EncodeHintType.CHARACTER_SET, "UTF-8"
            );
            BitMatrix matrix = writer.encode(qrContent, BarcodeFormat.QR_CODE, qrSize, qrSize, hints);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", baos);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header("Content-Disposition", "inline; filename=\"shield-qr-" + profile.getDnsClientId() + ".png\"")
                    .body(baos.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate QR code image", e);
        }
    }

    @GetMapping("/stats")
    @Operation(summary = "Device stats for admin dashboard")
    public ApiResponse<Map<String, Object>> deviceStats(
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) UUID tenantId) {
        if (!"GLOBAL_ADMIN".equals(role) && !"ISP_ADMIN".equals(role)) {
            throw ShieldException.forbidden("Admin role required");
        }
        long total = (tenantId != null && "ISP_ADMIN".equals(role))
                ? deviceRepository.findByTenantId(tenantId).size()
                : deviceRepository.count();
        long online = (tenantId != null && "ISP_ADMIN".equals(role))
                ? deviceRepository.countByTenantIdAndOnlineTrue(tenantId)
                : deviceRepository.countByOnlineTrue();
        return ApiResponse.ok(Map.of("totalDevices", total, "onlineDevices", online));
    }

    private UUID resolveCustomerId(UUID userId, String role) {
        if (!"CUSTOMER".equals(role)) {
            throw ShieldException.forbidden("CUSTOMER role required");
        }
        return customerRepository.findByUserId(userId)
                .orElseThrow(() -> ShieldException.notFound("Customer", userId))
                .getId();
    }
}
