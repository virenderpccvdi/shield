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
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChildProfileService {

    private static final Random RANDOM = new Random();

    @Value("${shield.app.domain:shield.rstglobal.in}")
    private String appDomain;

    @Value("${shield.dns.service.url:http://localhost:8284}")
    private String dnsServiceUrl;

    private static final RestTemplate REST_TEMPLATE = new RestTemplate();

    private final ChildProfileRepository childProfileRepository;
    private final CustomerRepository customerRepository;
    private final com.rstglobal.shield.profile.repository.DeviceRepository deviceRepository;

    @Transactional
    public ChildProfileResponse create(UUID customerId, UUID tenantId, CreateChildProfileRequest req) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> ShieldException.notFound("Customer", customerId));

        int count = childProfileRepository.countByCustomerIdAndActiveTrue(customerId);
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

        // Provision DNS rules in shield-dns (best-effort)
        try {
            String provisionUrl = dnsServiceUrl + "/internal/dns/provision?profileId=" + profile.getId()
                    + "&filterLevel=" + profile.getFilterLevel()
                    + "&clientId=" + profile.getDnsClientId()
                    + "&profileName=" + java.net.URLEncoder.encode(profile.getName(), java.nio.charset.StandardCharsets.UTF_8);
            if (tenantId != null) {
                provisionUrl += "&tenantId=" + tenantId;
            }
            REST_TEMPLATE.postForObject(provisionUrl, null, String.class);
        } catch (Exception e) {
            log.warn("DNS provisioning call failed for profile {}: {}", profile.getId(), e.getMessage());
        }

        return toResponse(profile);
    }

    public List<ChildProfileResponse> listByCustomer(UUID customerId) {
        List<ChildProfile> profiles = childProfileRepository.findByCustomerIdAndActiveTrue(customerId);
        if (profiles.isEmpty()) return List.of();
        List<UUID> profileIds = profiles.stream().map(ChildProfile::getId).toList();
        Map<UUID, List<com.rstglobal.shield.profile.entity.Device>> devicesByProfile =
                deviceRepository.findByProfileIdIn(profileIds).stream()
                        .collect(Collectors.groupingBy(com.rstglobal.shield.profile.entity.Device::getProfileId));
        return profiles.stream()
                .map(p -> toResponseWithDevices(p, devicesByProfile.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    public ChildProfileResponse getById(UUID id, UUID customerId) {
        ChildProfile profile = findOrThrow(id);
        if (!profile.getCustomerId().equals(customerId)) {
            throw ShieldException.forbidden("Access denied to this profile");
        }
        List<com.rstglobal.shield.profile.entity.Device> devices = deviceRepository.findByProfileId(id);
        return toResponseWithDevices(profile, devices);
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
        profile.setActive(false);
        childProfileRepository.save(profile);
        log.info("Soft-deleted child profile {} for customer {}", id, customerId);
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
            profiles = childProfileRepository.findByNameContainingIgnoreCaseAndActiveTrue(search.trim(), pr);
        } else {
            profiles = childProfileRepository.findByActiveTrue(pr);
        }
        return profiles.map(this::toResponse);
    }

    public ChildProfileResponse getByIdAdmin(UUID id) {
        ChildProfile profile = childProfileRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", id));
        return toResponse(profile);
    }

    @Transactional
    public void deleteAdmin(UUID id) {
        ChildProfile profile = childProfileRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", id));
        profile.setActive(false);
        childProfileRepository.save(profile);
        log.info("Admin soft-deleted child profile {}", id);
    }

    @Transactional
    public ChildProfileResponse updateAdmin(UUID id, UpdateChildProfileRequest req) {
        ChildProfile profile = childProfileRepository.findById(id)
                .orElseThrow(() -> ShieldException.notFound("ChildProfile", id));
        if (req.getName()        != null) profile.setName(req.getName());
        if (req.getAvatarUrl()   != null) profile.setAvatarUrl(req.getAvatarUrl());
        if (req.getDateOfBirth() != null) profile.setDateOfBirth(req.getDateOfBirth());
        if (req.getAgeGroup()    != null) profile.setAgeGroup(req.getAgeGroup());
        if (req.getFilterLevel() != null) profile.setFilterLevel(req.getFilterLevel());
        if (req.getNotes()       != null) profile.setNotes(req.getNotes());
        return toResponse(childProfileRepository.save(profile));
    }

    // ── ISP methods (tenant-scoped) ──────────────────────────────────────────

    public Page<ChildProfileResponse> listByTenant(UUID tenantId, int page, int size, String search) {
        PageRequest pr = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<ChildProfile> profiles;
        if (search != null && !search.isBlank()) {
            profiles = childProfileRepository.findByTenantIdAndNameContainingIgnoreCaseAndActiveTrue(tenantId, search.trim(), pr);
        } else {
            profiles = childProfileRepository.findByTenantIdAndActiveTrue(tenantId, pr);
        }
        return profiles.map(this::toResponse);
    }

    public ChildProfileResponse getByIdIsp(UUID id, UUID tenantId) {
        ChildProfile profile = findOrThrow(id);
        if (profile.getTenantId() == null || !tenantId.equals(profile.getTenantId())) {
            throw ShieldException.forbidden("Profile not in your tenant");
        }
        return toResponse(profile);
    }

    @Transactional
    public ChildProfileResponse updateIsp(UUID id, UUID tenantId, UpdateChildProfileRequest req) {
        ChildProfile profile = findOrThrow(id);
        if (profile.getTenantId() == null || !tenantId.equals(profile.getTenantId())) {
            throw ShieldException.forbidden("Profile not in your tenant");
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
    public void deleteIsp(UUID id, UUID tenantId) {
        ChildProfile profile = findOrThrow(id);
        if (profile.getTenantId() == null || !tenantId.equals(profile.getTenantId())) {
            throw ShieldException.forbidden("Profile not in your tenant");
        }
        profile.setActive(false);
        childProfileRepository.save(profile);
        log.info("ISP admin soft-deleted child profile {}", id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ChildProfile findOrThrow(UUID id) {
        return childProfileRepository.findByIdAndActiveTrue(id)
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
        return toResponseWithDevices(p, List.of());
    }

    private ChildProfileResponse toResponseWithDevices(ChildProfile p,
            List<com.rstglobal.shield.profile.entity.Device> devices) {
        boolean online = devices.stream().anyMatch(com.rstglobal.shield.profile.entity.Device::isOnline);
        Instant lastSeenAt = devices.stream()
                .map(com.rstglobal.shield.profile.entity.Device::getLastSeenAt)
                .filter(Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(null);
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
                .active(p.isActive())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .online(online)
                .lastSeenAt(lastSeenAt)
                .deviceCount(devices.size())
                .build();
    }
}
