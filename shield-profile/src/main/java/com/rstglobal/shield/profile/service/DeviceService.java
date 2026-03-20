package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateDeviceRequest;
import com.rstglobal.shield.profile.dto.response.DeviceResponse;
import com.rstglobal.shield.profile.entity.ChildProfile;
import com.rstglobal.shield.profile.entity.Device;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final ChildProfileRepository childProfileRepository;

    @Transactional
    public DeviceResponse register(UUID tenantId, UUID customerId, CreateDeviceRequest req) {
        ChildProfile profile = childProfileRepository.findById(req.getProfileId())
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", req.getProfileId()));
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }

        // Upsert: if a device of the same type already exists for this profile, return it
        String deviceType = req.getDeviceType() != null ? req.getDeviceType() : "PHONE";
        java.util.Optional<Device> existing = deviceRepository
                .findByProfileIdAndDeviceType(req.getProfileId(), deviceType);
        if (existing.isPresent()) {
            Device d = existing.get();
            // Update name if provided
            if (req.getName() != null && !req.getName().isBlank()) d.setName(req.getName());
            if (req.getMacAddress() != null) d.setMacAddress(req.getMacAddress());
            log.info("Device already exists for profile {} type {} — returning existing", req.getProfileId(), deviceType);
            return toResponse(deviceRepository.save(d));
        }

        Device device = Device.builder()
                .profileId(req.getProfileId())
                .name(req.getName())
                .deviceType(deviceType)
                .macAddress(req.getMacAddress())
                .dnsMethod(req.getDnsMethod() != null ? req.getDnsMethod() : "DOH")
                .build();
        device.setTenantId(tenantId);
        device = deviceRepository.save(device);
        log.info("Registered device '{}' to profile {}", device.getName(), req.getProfileId());
        return toResponse(device);
    }

    public List<DeviceResponse> listByProfile(UUID profileId, UUID customerId) {
        ChildProfile profile = childProfileRepository.findById(profileId)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", profileId));
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }
        return deviceRepository.findByProfileId(profileId).stream()
                .map(this::toResponse).toList();
    }

    public List<DeviceResponse> listByProfileAdmin(UUID profileId) {
        return deviceRepository.findByProfileId(profileId).stream()
                .map(this::toResponse)
                .collect(java.util.stream.Collectors.toList());
    }

    @Transactional
    public void deleteAdmin(UUID id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("Device", id));
        deviceRepository.delete(device);
    }

    @Transactional
    public void delete(UUID deviceId, UUID customerId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> ShieldException.notFound("Device", deviceId));
        ChildProfile profile = childProfileRepository.findById(device.getProfileId())
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", device.getProfileId()));
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied");
        }
        deviceRepository.delete(device);
    }

    /** Mark all devices for a profile as online, updating lastSeenAt. */
    @Transactional
    public void heartbeatByProfile(UUID profileId) {
        List<Device> devices = deviceRepository.findByProfileId(profileId);
        if (devices.isEmpty()) return;
        Instant now = Instant.now();
        devices.forEach(d -> {
            d.setOnline(true);
            d.setLastSeenAt(now);
        });
        deviceRepository.saveAll(devices);
    }

    /** Every 60 s: mark devices offline if their last heartbeat was > 5 min ago. */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void markStaleDevicesOffline() {
        Instant threshold = Instant.now().minusSeconds(300);
        List<Device> online = deviceRepository.findByOnlineTrue();
        List<Device> stale = online.stream()
                .filter(d -> d.getLastSeenAt() == null || d.getLastSeenAt().isBefore(threshold))
                .toList();
        if (!stale.isEmpty()) {
            stale.forEach(d -> d.setOnline(false));
            deviceRepository.saveAll(stale);
            log.info("Marked {} device(s) offline (stale heartbeat)", stale.size());
        }
    }

    private DeviceResponse toResponse(Device d) {
        return DeviceResponse.builder()
                .id(d.getId())
                .profileId(d.getProfileId())
                .tenantId(d.getTenantId())
                .name(d.getName())
                .deviceType(d.getDeviceType())
                .macAddress(d.getMacAddress())
                .online(d.isOnline())
                .lastSeenAt(d.getLastSeenAt())
                .dnsMethod(d.getDnsMethod())
                .createdAt(d.getCreatedAt())
                .build();
    }
}
