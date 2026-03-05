package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.dto.request.Tr069WebhookRequest;
import com.rstglobal.shield.admin.dto.response.Tr069ProvisionResponse;
import com.rstglobal.shield.admin.entity.Tr069Provision;
import com.rstglobal.shield.admin.repository.Tr069ProvisionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class Tr069Service {

    // Shield DNS server addresses (static defaults; override via config if needed)
    private static final String DNS_PRIMARY   = "45.136.100.70";
    private static final String DNS_SECONDARY = "45.136.100.71";

    private final Tr069ProvisionRepository provisionRepository;

    /**
     * Process a TR-069 INFORM event from an ACS webhook.
     * Looks up or creates a provision record and returns DNS server IPs.
     */
    @Transactional
    public Tr069ProvisionResponse handleWebhook(Tr069WebhookRequest req, UUID tenantId) {
        String serial = req.getDeviceSerial();
        if (serial == null || serial.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "deviceSerial is required");
        }

        Tr069Provision provision = provisionRepository
                .findByTenantIdAndDeviceSerial(tenantId, serial)
                .orElseGet(() -> Tr069Provision.builder()
                        .tenantId(tenantId)
                        .deviceSerial(serial)
                        .dnsPrimary(DNS_PRIMARY)
                        .dnsSecondary(DNS_SECONDARY)
                        .build());

        provision.setDeviceModel(req.getDeviceModel());
        provision.setMacAddress(req.getMacAddress());
        provision.setIpAddress(req.getIpAddress());
        provision.setLastSeenAt(OffsetDateTime.now());
        provision.setRawData(req.getRawData());

        if ("PENDING".equals(provision.getProvisionStatus()) || provision.getProvisionedAt() == null) {
            provision.setProvisionStatus("PROVISIONED");
            provision.setProvisionedAt(OffsetDateTime.now());
        }

        provision = provisionRepository.save(provision);
        log.info("TR-069 INFORM processed for tenant={} serial={}", tenantId, serial);
        return toResponse(provision);
    }

    public Page<Tr069ProvisionResponse> listProvisions(UUID tenantId, Pageable pageable) {
        return provisionRepository.findByTenantId(tenantId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public void deprovision(UUID provisionId) {
        Tr069Provision provision = provisionRepository.findById(provisionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Provision record not found: " + provisionId));
        provision.setProvisionStatus("DEPROVISIONED");
        provisionRepository.save(provision);
        log.info("Deprovisioned device {}", provisionId);
    }

    private Tr069ProvisionResponse toResponse(Tr069Provision p) {
        return Tr069ProvisionResponse.builder()
                .id(p.getId())
                .deviceSerial(p.getDeviceSerial())
                .deviceModel(p.getDeviceModel())
                .macAddress(p.getMacAddress())
                .ipAddress(p.getIpAddress())
                .dnsPrimary(p.getDnsPrimary())
                .dnsSecondary(p.getDnsSecondary())
                .provisionStatus(p.getProvisionStatus())
                .provisionedAt(p.getProvisionedAt())
                .lastSeenAt(p.getLastSeenAt())
                .build();
    }
}
