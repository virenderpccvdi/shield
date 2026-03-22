package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.dto.request.IspCommunicationRequest;
import com.rstglobal.shield.notification.dto.response.IspCommunicationResponse;
import com.rstglobal.shield.notification.entity.IspCommunication;
import com.rstglobal.shield.notification.repository.IspCommunicationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * IS-02: ISP Customer Communication.
 * Sends broadcast announcements / service alerts to all customers of a tenant
 * via Email (SMTP) and/or FCM push notifications to the tenant topic.
 */
@Slf4j
@Service
public class IspCommunicationService {

    private static final String PROFILE_SERVICE = "SHIELD-PROFILE";

    private final IspCommunicationRepository commRepo;
    private final EmailService emailService;
    private final FcmService fcmService;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public IspCommunicationService(IspCommunicationRepository commRepo,
                                    EmailService emailService,
                                    FcmService fcmService,
                                    DiscoveryClient discoveryClient) {
        this.commRepo = commRepo;
        this.emailService = emailService;
        this.fcmService = fcmService;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    // ── Send ──────────────────────────────────────────────────────────────────

    @Transactional
    public IspCommunicationResponse send(IspCommunicationRequest req) {
        String channel = req.getChannel() != null ? req.getChannel().toUpperCase() : "EMAIL";

        // Persist the record first (status = SENDING)
        IspCommunication comm = IspCommunication.builder()
                .tenantId(req.getTenantId())
                .subject(req.getSubject())
                .body(req.getBody())
                .channel(channel)
                .sentBy(req.getSentBy())
                .status("SENDING")
                .build();
        comm = commRepo.save(comm);

        int recipientCount = 0;

        // ── Email dispatch ──────────────────────────────────────────────────
        if ("EMAIL".equals(channel) || "BOTH".equals(channel)) {
            List<Map<String, Object>> customers = fetchCustomers(req.getTenantId());
            log.info("ISP comm: sending email to {} customers for tenantId={}",
                    customers.size(), req.getTenantId());
            for (Map<String, Object> customer : customers) {
                String email = extractEmail(customer);
                if (email == null || email.isBlank()) continue;
                boolean sent = emailService.sendPlainEmail(
                        req.getTenantId(), email, req.getSubject(), req.getBody());
                if (sent) recipientCount++;
            }
        }

        // ── Push dispatch via FCM topic ─────────────────────────────────────
        if ("PUSH".equals(channel) || "BOTH".equals(channel)) {
            String topic = "tenant-" + req.getTenantId();
            String msgId = fcmService.sendToTopic(topic, req.getSubject(), req.getBody(), null);
            if (msgId != null) {
                recipientCount = Math.max(recipientCount, 1); // at least 1 topic push sent
            }
            log.info("ISP comm: FCM topic push to '{}' msgId={}", topic, msgId);
        }

        // ── Finalise record ─────────────────────────────────────────────────
        comm.setRecipientCount(recipientCount);
        comm.setStatus("SENT");
        comm = commRepo.save(comm);
        log.info("ISP communication sent: id={} tenantId={} channel={} recipients={}",
                comm.getId(), comm.getTenantId(), channel, recipientCount);
        return toResponse(comm);
    }

    // ── History ───────────────────────────────────────────────────────────────

    public Page<IspCommunicationResponse> getHistory(UUID tenantId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return commRepo.findByTenantIdOrderBySentAtDesc(tenantId, pageable)
                .map(this::toResponse);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Fetch all customer records for the tenant from shield-profile.
     * Returns empty list on any failure.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchCustomers(UUID tenantId) {
        try {
            String baseUrl = resolveService(PROFILE_SERVICE);
            if (baseUrl == null) return List.of();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "/internal/profiles/customers?tenantId=" + tenantId + "&size=5000")
                    .header("X-Internal-Call", "true")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response == null) return List.of();

            Object data = response.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object content = dataMap.get("content");
                if (content instanceof List<?> list) {
                    return (List<Map<String, Object>>) list;
                }
            }
            if (data instanceof List<?> list) {
                return (List<Map<String, Object>>) list;
            }
            return List.of();
        } catch (Exception e) {
            log.warn("Failed to fetch customers for tenantId={}: {}", tenantId, e.getMessage());
            return List.of();
        }
    }

    private String extractEmail(Map<String, Object> customer) {
        Object email = customer.get("email");
        if (email instanceof String s) return s;
        return null;
    }

    private String resolveService(String serviceId) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceId);
        if (instances.isEmpty()) {
            log.warn("No instances of {} found in Eureka", serviceId);
            return null;
        }
        ServiceInstance instance = instances.get(0);
        return instance.getUri().toString();
    }

    private IspCommunicationResponse toResponse(IspCommunication c) {
        return IspCommunicationResponse.builder()
                .id(c.getId())
                .tenantId(c.getTenantId())
                .subject(c.getSubject())
                .body(c.getBody())
                .channel(c.getChannel())
                .sentBy(c.getSentBy())
                .sentAt(c.getSentAt())
                .recipientCount(c.getRecipientCount())
                .status(c.getStatus())
                .build();
    }
}
