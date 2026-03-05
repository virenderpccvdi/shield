package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.SosRequest;
import com.rstglobal.shield.location.dto.response.SosEventResponse;
import com.rstglobal.shield.location.entity.SosEvent;
import com.rstglobal.shield.location.repository.SosEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SosService {

    private final SosEventRepository sosEventRepository;

    @Transactional
    public SosEventResponse triggerSos(SosRequest req) {
        SosEvent event = SosEvent.builder()
                .profileId(req.getProfileId())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .message(req.getMessage())
                .status("ACTIVE")
                .build();

        event = sosEventRepository.save(event);

        // TODO: integrate with shield-notification to send push/SMS alert to parent
        log.warn("SOS TRIGGERED: profile={} lat={} lng={} message='{}'",
                req.getProfileId(), req.getLatitude(), req.getLongitude(), req.getMessage());

        return toResponse(event);
    }

    @Transactional
    public SosEventResponse acknowledgeSos(UUID sosId, UUID userId) {
        SosEvent event = sosEventRepository.findById(sosId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SOS event not found: " + sosId));

        if (!"ACTIVE".equals(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SOS event is not in ACTIVE state");
        }

        event.setStatus("ACKNOWLEDGED");
        event.setAcknowledgedAt(OffsetDateTime.now());
        event = sosEventRepository.save(event);
        log.info("SOS {} acknowledged by user {}", sosId, userId);
        return toResponse(event);
    }

    @Transactional
    public SosEventResponse resolveSos(UUID sosId, UUID userId) {
        SosEvent event = sosEventRepository.findById(sosId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SOS event not found: " + sosId));

        if ("RESOLVED".equals(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SOS event is already RESOLVED");
        }

        event.setStatus("RESOLVED");
        event.setResolvedAt(OffsetDateTime.now());
        event = sosEventRepository.save(event);
        log.info("SOS {} resolved by user {}", sosId, userId);
        return toResponse(event);
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getActiveSosEvents(UUID profileId) {
        return sosEventRepository.findByProfileIdAndStatusOrderByTriggeredAtDesc(profileId, "ACTIVE")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SosEventResponse> getAllSosEvents(UUID profileId) {
        return sosEventRepository.findByProfileIdOrderByTriggeredAtDesc(profileId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private SosEventResponse toResponse(SosEvent e) {
        return SosEventResponse.builder()
                .id(e.getId())
                .profileId(e.getProfileId())
                .latitude(e.getLatitude())
                .longitude(e.getLongitude())
                .message(e.getMessage())
                .status(e.getStatus())
                .triggeredAt(e.getTriggeredAt())
                .build();
    }
}
