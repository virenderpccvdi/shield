package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.dto.request.FcmTokenRequest;
import com.rstglobal.shield.notification.entity.DeviceToken;
import com.rstglobal.shield.notification.repository.DeviceTokenRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

/**
 * FCM token registration/unregistration endpoints.
 * Called by the Flutter app after Firebase initialization.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/notifications/fcm")
@RequiredArgsConstructor
public class FcmTokenController {

    private final DeviceTokenRepository tokenRepo;

    /**
     * Register or update an FCM token for a device.
     * If the same userId+token already exists, updates the device name and reactivates it.
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<String>> registerToken(
            @Valid @RequestBody FcmTokenRequest req) {

        Optional<DeviceToken> existing = tokenRepo.findByUserIdAndToken(
                req.getUserId(), req.getFcmToken());

        if (existing.isPresent()) {
            DeviceToken dt = existing.get();
            dt.setActive(true);
            dt.setPlatform(req.getPlatform());
            if (req.getDeviceName() != null) dt.setDeviceName(req.getDeviceName());
            tokenRepo.save(dt);
            log.info("FCM token updated for userId={} platform={}", req.getUserId(), req.getPlatform());
        } else {
            DeviceToken dt = DeviceToken.builder()
                    .userId(req.getUserId())
                    .tenantId(req.getTenantId())
                    .platform(req.getPlatform())
                    .token(req.getFcmToken())
                    .deviceName(req.getDeviceName())
                    .active(true)
                    .build();
            tokenRepo.save(dt);
            log.info("FCM token registered for userId={} platform={}", req.getUserId(), req.getPlatform());
        }

        return ResponseEntity.status(HttpStatus.OK)
                .body(ApiResponse.ok("FCM token registered"));
    }

    /**
     * Unregister (deactivate) an FCM token.
     * Called on logout or when app is uninstalled.
     */
    @DeleteMapping("/unregister")
    public ResponseEntity<ApiResponse<String>> unregisterToken(
            @RequestParam UUID userId,
            @RequestParam String fcmToken) {

        tokenRepo.findByUserIdAndToken(userId, fcmToken).ifPresent(dt -> {
            dt.setActive(false);
            tokenRepo.save(dt);
            log.info("FCM token deactivated for userId={}", userId);
        });

        return ResponseEntity.ok(ApiResponse.ok("FCM token unregistered"));
    }
}
