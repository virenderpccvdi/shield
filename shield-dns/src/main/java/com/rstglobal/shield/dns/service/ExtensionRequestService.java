package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ExtensionRequestDto;
import com.rstglobal.shield.dns.dto.response.ExtensionRequestResponse;
import com.rstglobal.shield.dns.entity.ExtensionRequest;
import com.rstglobal.shield.dns.repository.ExtensionRequestRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class ExtensionRequestService {

    private static final String NOTIFICATION_SERVICE = "SHIELD-NOTIFICATION";

    private final ExtensionRequestRepository requestRepo;
    private final BudgetService budgetService;
    private final DiscoveryClient discoveryClient;
    private final RestClient restClient;

    public ExtensionRequestService(ExtensionRequestRepository requestRepo,
                                    BudgetService budgetService,
                                    DiscoveryClient discoveryClient) {
        this.requestRepo = requestRepo;
        this.budgetService = budgetService;
        this.discoveryClient = discoveryClient;
        this.restClient = RestClient.builder().build();
    }

    @Transactional
    public ExtensionRequestResponse submitRequest(UUID profileId, UUID customerId, ExtensionRequestDto req) {
        ExtensionRequest entity = ExtensionRequest.builder()
                .profileId(profileId)
                .customerId(customerId)
                .appName(req.getAppName())
                .requestedMins(req.getRequestedMins())
                .message(req.getMessage())
                .build();
        ExtensionRequestResponse saved = toResponse(requestRepo.save(entity));
        // Notify parent via push notification
        notifyParent(profileId, customerId, req.getAppName(), req.getRequestedMins(),
                req.getMessage(), saved.getId());
        return saved;
    }

    private void notifyParent(UUID profileId, UUID customerId, String appName, int mins,
                               String message, UUID requestId) {
        try {
            List<ServiceInstance> instances = discoveryClient.getInstances(NOTIFICATION_SERVICE);
            if (instances.isEmpty()) return;
            String baseUrl = instances.get(0).getUri().toString();

            String body = "Your child requested " + mins + " extra minutes"
                    + (appName != null && !appName.isBlank() ? " for " + appName : "")
                    + (message != null && !message.isBlank() ? ": \"" + message + "\"" : "");

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "EXTENSION_REQUEST");
            payload.put("title", "Screen Time Request");
            payload.put("body", body);
            payload.put("userId", customerId.toString());
            payload.put("profileId", profileId.toString());
            payload.put("tenantId", "00000000-0000-0000-0000-000000000000");
            payload.put("actionUrl", "https://shield.rstglobal.in/app/time-limits");
            payload.put("requestId", requestId.toString());

            restClient.post()
                    .uri(baseUrl + "/internal/notifications/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Extension request notification sent to parent customerId={}", customerId);
        } catch (Exception e) {
            log.warn("Failed to send extension request notification for customerId={}: {}", customerId, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<ExtensionRequestResponse> getPendingRequests(UUID customerId) {
        return requestRepo.findByCustomerIdAndStatusOrderByCreatedAtDesc(customerId, "PENDING")
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ExtensionRequestResponse approveRequest(UUID requestId) {
        ExtensionRequest entity = requestRepo.findById(requestId)
                .orElseThrow(() -> ShieldException.notFound("extension-request", requestId.toString()));
        if (!"PENDING".equals(entity.getStatus())) {
            throw ShieldException.conflict("Request already " + entity.getStatus());
        }
        entity.setStatus("APPROVED");
        entity.setRespondedAt(OffsetDateTime.now());
        requestRepo.save(entity);
        budgetService.grantExtension(entity.getProfileId(), entity.getAppName(), entity.getRequestedMins());
        return toResponse(entity);
    }

    @Transactional
    public ExtensionRequestResponse rejectRequest(UUID requestId) {
        ExtensionRequest entity = requestRepo.findById(requestId)
                .orElseThrow(() -> ShieldException.notFound("extension-request", requestId.toString()));
        if (!"PENDING".equals(entity.getStatus())) {
            throw ShieldException.conflict("Request already " + entity.getStatus());
        }
        entity.setStatus("REJECTED");
        entity.setRespondedAt(OffsetDateTime.now());
        return toResponse(requestRepo.save(entity));
    }

    private ExtensionRequestResponse toResponse(ExtensionRequest e) {
        return ExtensionRequestResponse.builder()
                .id(e.getId())
                .profileId(e.getProfileId())
                .appName(e.getAppName())
                .requestedMins(e.getRequestedMins())
                .message(e.getMessage())
                .status(e.getStatus())
                .createdAt(e.getCreatedAt())
                .respondedAt(e.getRespondedAt())
                .build();
    }
}
