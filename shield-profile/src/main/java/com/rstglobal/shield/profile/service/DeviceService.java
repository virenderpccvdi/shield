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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        Device device = Device.builder()
                .profileId(req.getProfileId())
                .name(req.getName())
                .deviceType(req.getDeviceType())
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
