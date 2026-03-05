package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ExtensionRequestDto;
import com.rstglobal.shield.dns.dto.response.ExtensionRequestResponse;
import com.rstglobal.shield.dns.entity.ExtensionRequest;
import com.rstglobal.shield.dns.repository.ExtensionRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExtensionRequestService {

    private final ExtensionRequestRepository requestRepo;
    private final BudgetService budgetService;

    @Transactional
    public ExtensionRequestResponse submitRequest(UUID profileId, UUID customerId, ExtensionRequestDto req) {
        ExtensionRequest entity = ExtensionRequest.builder()
                .profileId(profileId)
                .customerId(customerId)
                .appName(req.getAppName())
                .requestedMins(req.getRequestedMins())
                .message(req.getMessage())
                .build();
        return toResponse(requestRepo.save(entity));
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
