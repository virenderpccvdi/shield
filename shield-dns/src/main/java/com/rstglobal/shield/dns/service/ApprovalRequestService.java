package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.CreateApprovalRequestDto;
import com.rstglobal.shield.dns.dto.response.ApprovalRequestResponse;
import com.rstglobal.shield.dns.entity.ApprovalRequest;
import com.rstglobal.shield.dns.entity.DnsRules;
import com.rstglobal.shield.dns.repository.ApprovalRequestRepository;
import com.rstglobal.shield.dns.repository.DnsRulesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.*;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalRequestService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final ApprovalRequestRepository approvalRepo;
    private final DnsRulesRepository rulesRepo;
    private final DnsRulesService dnsRulesService;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient = RestClient.builder().build();

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Child app submits a permission request for a blocked domain or app.
     * Saves with PENDING status and sends FCM push to the parent (customerId).
     */
    @Transactional
    public ApprovalRequestResponse createRequest(CreateApprovalRequestDto dto) {
        String requestType = dto.getRequestType() != null ? dto.getRequestType().toUpperCase() : "DOMAIN";
        ApprovalRequest entity = ApprovalRequest.builder()
                .tenantId(dto.getTenantId())
                .profileId(dto.getProfileId())
                .customerId(dto.getCustomerId())
                .domain(dto.getDomain() != null ? dto.getDomain().toLowerCase().trim() : null)
                .appPackage(dto.getAppPackage())
                .requestType(requestType)
                .build();
        ApprovalRequest saved = approvalRepo.save(entity);
        log.info("Approval request created: id={} profile={} domain={}", saved.getId(), saved.getProfileId(), saved.getDomain());

        // Notify parent via FCM push (fire-and-forget — non-critical)
        notifyParent(saved);

        return toResponse(saved);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ApprovalRequestResponse> getByProfile(UUID profileId) {
        return approvalRepo.findByProfileIdOrderByCreatedAtDesc(profileId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalRequestResponse> getPendingByProfile(UUID profileId) {
        return approvalRepo.findByProfileIdAndStatusOrderByCreatedAtDesc(profileId, "PENDING")
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalRequestResponse> getPendingByTenant(UUID tenantId) {
        return approvalRepo.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, "PENDING")
                .stream().map(this::toResponse).toList();
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    /**
     * Parent approves a pending request.
     * <ul>
     *   <li>ONE_HOUR  → expiresAt = now + 1 hour</li>
     *   <li>TODAY     → expiresAt = midnight of today (local)</li>
     *   <li>PERMANENT → no expiry, domain stays in allowlist forever</li>
     * </ul>
     * The domain is immediately added to the profile's custom_allowlist.
     * FCM push sent to the child's profile.
     */
    @Transactional
    public ApprovalRequestResponse approve(UUID requestId, UUID approverId, String durationType) {
        ApprovalRequest entity = findPending(requestId);
        entity.setStatus("APPROVED");
        entity.setResolvedAt(OffsetDateTime.now());
        entity.setResolvedBy(approverId);
        entity.setDurationType(durationType.toUpperCase());

        switch (durationType.toUpperCase()) {
            case "ONE_HOUR"   -> entity.setExpiresAt(OffsetDateTime.now().plusHours(1));
            case "TODAY"      -> entity.setExpiresAt(todayMidnight());
            case "PERMANENT"  -> entity.setExpiresAt(null);
            default           -> throw ShieldException.badRequest("Invalid durationType: " + durationType
                    + ". Must be ONE_HOUR, TODAY, or PERMANENT.");
        }

        approvalRepo.save(entity);

        // Add domain to allowlist
        if (entity.getDomain() != null) {
            addToAllowlist(entity.getProfileId(), entity.getTenantId(), entity.getDomain());
        }

        // Notify child
        notifyChild(entity, true);

        return toResponse(entity);
    }

    // ── Deny ──────────────────────────────────────────────────────────────────

    /**
     * Parent denies a pending request.
     * FCM push sent to the child's profile.
     */
    @Transactional
    public ApprovalRequestResponse deny(UUID requestId, UUID approverId) {
        ApprovalRequest entity = findPending(requestId);
        entity.setStatus("DENIED");
        entity.setResolvedAt(OffsetDateTime.now());
        entity.setResolvedBy(approverId);
        approvalRepo.save(entity);

        notifyChild(entity, false);

        return toResponse(entity);
    }

    // ── Expiry ────────────────────────────────────────────────────────────────

    /**
     * Called every 5 minutes by {@link ApprovalExpiryJob}.
     * Finds APPROVED requests whose expiresAt has passed, removes domain from allowlist,
     * and sets status to EXPIRED.
     */
    @Transactional
    public void expireAll() {
        List<ApprovalRequest> expired = approvalRepo.findByStatusAndExpiresAtBefore("APPROVED", OffsetDateTime.now());
        if (expired.isEmpty()) return;

        for (ApprovalRequest req : expired) {
            try {
                if (req.getDomain() != null) {
                    removeFromAllowlist(req.getProfileId(), req.getTenantId(), req.getDomain());
                }
                req.setStatus("EXPIRED");
                approvalRepo.save(req);
                log.info("Approval expired: id={} profile={} domain={}", req.getId(), req.getProfileId(), req.getDomain());
            } catch (Exception e) {
                log.warn("Failed to expire approval request id={}: {}", req.getId(), e.getMessage());
            }
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ApprovalRequest findPending(UUID requestId) {
        ApprovalRequest entity = approvalRepo.findById(requestId)
                .orElseThrow(() -> ShieldException.notFound("approval-request", requestId.toString()));
        if (!"PENDING".equals(entity.getStatus())) {
            throw ShieldException.conflict("Request already " + entity.getStatus());
        }
        return entity;
    }

    private void addToAllowlist(UUID profileId, UUID tenantId, String domain) {
        try {
            DnsRules rules = rulesRepo.findByProfileId(profileId).orElse(null);
            if (rules == null) {
                log.warn("addToAllowlist: no DNS rules for profileId={}", profileId);
                return;
            }
            List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));
            if (!allow.contains(domain)) {
                allow.add(domain);
                rules.setCustomAllowlist(allow);
                rulesRepo.save(rules);
                dnsRulesService.syncRules(profileId);
                log.info("Domain '{}' added to allowlist for profileId={}", domain, profileId);
            }
        } catch (Exception e) {
            log.warn("Failed to add domain '{}' to allowlist for profile={}: {}", domain, profileId, e.getMessage());
        }
    }

    private void removeFromAllowlist(UUID profileId, UUID tenantId, String domain) {
        try {
            DnsRules rules = rulesRepo.findByProfileId(profileId).orElse(null);
            if (rules == null) return;
            List<String> allow = new ArrayList<>(Optional.ofNullable(rules.getCustomAllowlist()).orElse(List.of()));
            if (allow.remove(domain)) {
                rules.setCustomAllowlist(allow);
                rulesRepo.save(rules);
                dnsRulesService.syncRules(profileId);
                log.info("Domain '{}' removed from allowlist for profileId={} (expired approval)", domain, profileId);
            }
        } catch (Exception e) {
            log.warn("Failed to remove domain '{}' from allowlist for profile={}: {}", domain, profileId, e.getMessage());
        }
    }

    /**
     * Sends FCM push to the parent (customerId) notifying them of a new permission request.
     */
    private void notifyParent(ApprovalRequest req) {
        if (req.getCustomerId() == null) return;
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            String subject = "APP".equals(req.getRequestType()) ? req.getAppPackage() : req.getDomain();
            Map<String, String> data = new LinkedHashMap<>();
            data.put("type", "APPROVAL_REQUEST");
            data.put("requestId", req.getId().toString());
            data.put("profileId", req.getProfileId().toString());
            data.put("requestType", req.getRequestType());
            if (req.getDomain() != null)     data.put("domain", req.getDomain());
            if (req.getAppPackage() != null) data.put("appPackage", req.getAppPackage());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("userId", req.getCustomerId().toString());
            payload.put("title", "Permission Request");
            payload.put("body", "Your child wants to access " + subject);
            payload.put("priority", "HIGH");
            payload.put("data", data);

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.debug("Parent FCM push sent: customerId={} domain={}", req.getCustomerId(), req.getDomain());
        } catch (Exception e) {
            log.warn("Failed to send parent FCM for approval request {}: {}", req.getId(), e.getMessage());
        }
    }

    /**
     * Sends FCM push to the child's profile notifying them of the parent's decision.
     */
    private void notifyChild(ApprovalRequest req, boolean approved) {
        try {
            String baseUrl = resolveNotificationUrl();
            if (baseUrl == null) return;

            String subject = "APP".equals(req.getRequestType()) ? req.getAppPackage() : req.getDomain();
            String title = approved ? "Access Approved" : "Access Denied";
            String body  = approved
                    ? "Your request to access " + subject + " has been approved."
                    : "Your request to access " + subject + " has been denied.";

            Map<String, String> data = new LinkedHashMap<>();
            data.put("type", approved ? "APPROVAL_APPROVED" : "APPROVAL_DENIED");
            data.put("requestId", req.getId().toString());
            data.put("requestType", req.getRequestType());
            if (req.getDomain() != null)     data.put("domain", req.getDomain());
            if (req.getAppPackage() != null) data.put("appPackage", req.getAppPackage());

            // Push to profile ID as topic (child devices subscribe to profile topic)
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("topic", "profile-" + req.getProfileId());
            payload.put("title", title);
            payload.put("body", body);
            payload.put("data", data);

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/push")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            log.debug("Child FCM push sent: profileId={} approved={} domain={}", req.getProfileId(), approved, req.getDomain());
        } catch (Exception e) {
            log.warn("Failed to send child FCM for approval request {}: {}", req.getId(), e.getMessage());
        }
    }

    private String resolveNotificationUrl() {
        List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
        if (instances.isEmpty()) {
            log.warn("No instances of {} in Eureka — skipping approval notification", NOTIFICATION_SERVICE);
            return null;
        }
        return instances.get(0).getUri().toString();
    }

    /** Returns OffsetDateTime at midnight end-of-day in the system default timezone. */
    private OffsetDateTime todayMidnight() {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        return today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    private ApprovalRequestResponse toResponse(ApprovalRequest e) {
        return ApprovalRequestResponse.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .profileId(e.getProfileId())
                .customerId(e.getCustomerId())
                .domain(e.getDomain())
                .appPackage(e.getAppPackage())
                .requestType(e.getRequestType())
                .status(e.getStatus())
                .durationType(e.getDurationType())
                .expiresAt(e.getExpiresAt())
                .createdAt(e.getCreatedAt())
                .resolvedAt(e.getResolvedAt())
                .resolvedBy(e.getResolvedBy())
                .build();
    }
}
