package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateChildProfileRequest;
import com.rstglobal.shield.profile.dto.request.UpdateChildProfileRequest;
import com.rstglobal.shield.profile.dto.response.ChildProfileResponse;
import com.rstglobal.shield.profile.entity.ChildProfile;
import com.rstglobal.shield.profile.entity.Customer;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChildProfileService {

    private static final Random RANDOM = new Random();

    @Value("${shield.app.domain:shield.rstglobal.in}")
    private String appDomain;

    private final ChildProfileRepository childProfileRepository;
    private final CustomerRepository customerRepository;
    private final com.rstglobal.shield.profile.repository.DeviceRepository deviceRepository;

    @Transactional
    public ChildProfileResponse create(UUID customerId, UUID tenantId, CreateChildProfileRequest req) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> ShieldException.notFound("Customer", customerId));

        int count = childProfileRepository.countByCustomerId(customerId);
        if (count >= customer.getMaxProfiles()) {
            throw ShieldException.badRequest(
                    "Profile limit reached (" + customer.getMaxProfiles() + " max)");
        }

        String dnsClientId = generateDnsClientId(req.getName());

        ChildProfile profile = ChildProfile.builder()
                .customerId(customerId)
                .name(req.getName())
                .avatarUrl(req.getAvatarUrl())
                .dateOfBirth(req.getDateOfBirth())
                .ageGroup(req.getAgeGroup() != null ? req.getAgeGroup() : "CHILD")
                .filterLevel(req.getFilterLevel() != null ? req.getFilterLevel() : "STRICT")
                .dnsClientId(dnsClientId)
                .notes(req.getNotes())
                .build();
        profile.setTenantId(tenantId);

        profile = childProfileRepository.save(profile);
        log.info("Created child profile '{}' (dnsClientId={}) for customer {}",
                profile.getName(), dnsClientId, customerId);
        return toResponse(profile);
    }

    public List<ChildProfileResponse> listByCustomer(UUID customerId) {
        return childProfileRepository.findByCustomerId(customerId).stream()
                .map(this::toResponse).toList();
    }

    public ChildProfileResponse getById(UUID id, UUID customerId) {
        ChildProfile profile = findOrThrow(id);
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }
        return toResponse(profile);
    }

    @Transactional
    public ChildProfileResponse update(UUID id, UUID customerId, UpdateChildProfileRequest req) {
        ChildProfile profile = findOrThrow(id);
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }
        if (req.getName()        != null) profile.setName(req.getName());
        if (req.getAvatarUrl()   != null) profile.setAvatarUrl(req.getAvatarUrl());
        if (req.getDateOfBirth() != null) profile.setDateOfBirth(req.getDateOfBirth());
        if (req.getAgeGroup()    != null) profile.setAgeGroup(req.getAgeGroup());
        if (req.getFilterLevel() != null) profile.setFilterLevel(req.getFilterLevel());
        if (req.getNotes()       != null) profile.setNotes(req.getNotes());
        return toResponse(childProfileRepository.save(profile));
    }

    @Transactional
    public void delete(UUID id, UUID customerId) {
        ChildProfile profile = findOrThrow(id);
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }
        childProfileRepository.delete(profile);
        log.info("Deleted child profile {} for customer {}", id, customerId);
    }

    /**
     * Returns the online status, last seen time, and battery level for a child profile.
     * Checks all devices associated with the profile.
     */
    public Map<String, Object> getChildStatus(UUID id, UUID customerId) {
        ChildProfile profile = findOrThrow(id);
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }

        List<com.rstglobal.shield.profile.entity.Device> devices = deviceRepository.findByProfileId(id);
        boolean online = devices.stream().anyMatch(com.rstglobal.shield.profile.entity.Device::isOnline);
        Instant lastSeen = devices.stream()
                .map(com.rstglobal.shield.profile.entity.Device::getLastSeenAt)
                .filter(Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(null);

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("profileId", id);
        status.put("name", profile.getName());
        status.put("online", online);
        status.put("lastSeenAt", lastSeen);
        status.put("deviceCount", devices.size());
        status.put("onlineDevices", devices.stream().filter(com.rstglobal.shield.profile.entity.Device::isOnline).count());
        return status;
    }

    public String getDohUrl(UUID id, UUID customerId) {
        ChildProfile profile = findOrThrow(id);
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }
        return buildDohUrl(profile.getDnsClientId());
    }

    // ── Admin methods ────────────────────────────────────────────────────────

    public Page<ChildProfileResponse> listAll(int page, int size, String search) {
        PageRequest pr = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<ChildProfile> profiles;
        if (search != null && !search.isBlank()) {
            profiles = childProfileRepository.findByNameContainingIgnoreCase(search.trim(), pr);
        } else {
            profiles = childProfileRepository.findAll(pr);
        }
        return profiles.map(this::toResponse);
    }

    public ChildProfileResponse getByIdAdmin(UUID id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional
    public void deleteAdmin(UUID id) {
        ChildProfile profile = findOrThrow(id);
        childProfileRepository.delete(profile);
        log.info("Admin deleted child profile {}", id);
    }

    @Transactional
    public ChildProfileResponse updateAdmin(UUID id, UpdateChildProfileRequest req) {
        ChildProfile profile = findOrThrow(id);
        if (req.getName()        != null) profile.setName(req.getName());
        if (req.getAvatarUrl()   != null) profile.setAvatarUrl(req.getAvatarUrl());
        if (req.getDateOfBirth() != null) profile.setDateOfBirth(req.getDateOfBirth());
        if (req.getAgeGroup()    != null) profile.setAgeGroup(req.getAgeGroup());
        if (req.getFilterLevel() != null) profile.setFilterLevel(req.getFilterLevel());
        if (req.getNotes()       != null) profile.setNotes(req.getNotes());
        return toResponse(childProfileRepository.save(profile));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ChildProfile findOrThrow(UUID id) {
        return childProfileRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", id));
    }

    private String generateDnsClientId(String name) {
        // Sanitise name: lowercase, letters/digits only, max 12 chars
        String slug = name.toLowerCase()
                .replaceAll("[^a-z0-9]", "")
                .substring(0, Math.min(name.replaceAll("[^a-zA-Z0-9]", "").length(), 12));
        if (slug.isBlank()) slug = "child";

        // Append 4 random hex chars for uniqueness
        String suffix = HexFormat.of().toHexDigits(RANDOM.nextInt(0xFFFF)).substring(0, 4);
        String clientId = slug + "-" + suffix;

        // Retry on collision (extremely rare)
        while (childProfileRepository.existsByDnsClientId(clientId)) {
            suffix = HexFormat.of().toHexDigits(RANDOM.nextInt(0xFFFF)).substring(0, 4);
            clientId = slug + "-" + suffix;
        }
        return clientId;
    }

    private String buildDohUrl(String dnsClientId) {
        return "https://" + dnsClientId + ".dns." + appDomain + "/dns-query";
    }

    private ChildProfileResponse toResponse(ChildProfile p) {
        return ChildProfileResponse.builder()
                .id(p.getId())
                .customerId(p.getCustomerId())
                .tenantId(p.getTenantId())
                .name(p.getName())
                .avatarUrl(p.getAvatarUrl())
                .dateOfBirth(p.getDateOfBirth())
                .ageGroup(p.getAgeGroup())
                .filterLevel(p.getFilterLevel())
                .dnsClientId(p.getDnsClientId())
                .dohUrl(buildDohUrl(p.getDnsClientId()))
                .notes(p.getNotes())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
