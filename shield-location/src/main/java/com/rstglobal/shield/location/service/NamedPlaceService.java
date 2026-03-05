package com.rstglobal.shield.location.service;

import com.rstglobal.shield.location.dto.request.NamedPlaceRequest;
import com.rstglobal.shield.location.dto.response.NamedPlaceResponse;
import com.rstglobal.shield.location.entity.NamedPlace;
import com.rstglobal.shield.location.repository.NamedPlaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NamedPlaceService {

    private final NamedPlaceRepository namedPlaceRepository;

    @Transactional
    public NamedPlaceResponse createNamedPlace(NamedPlaceRequest req, UUID profileId, UUID tenantId) {
        NamedPlace place = NamedPlace.builder()
                .tenantId(tenantId)
                .profileId(profileId)
                .name(req.getName())
                .placeType(req.getPlaceType() != null ? req.getPlaceType() : "CUSTOM")
                .centerLat(req.getCenterLat())
                .centerLng(req.getCenterLng())
                .radiusMeters(req.getRadiusMeters() != null ? req.getRadiusMeters() : BigDecimal.valueOf(150))
                .build();

        place = namedPlaceRepository.save(place);
        log.info("Created named place '{}' for profile {}", place.getName(), profileId);
        return toResponse(place);
    }

    @Transactional(readOnly = true)
    public List<NamedPlaceResponse> listNamedPlaces(UUID profileId) {
        return namedPlaceRepository.findByProfileIdOrderByCreatedAtDesc(profileId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public NamedPlaceResponse updateNamedPlace(UUID id, NamedPlaceRequest req) {
        NamedPlace place = namedPlaceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Named place not found: " + id));

        place.setName(req.getName());
        if (req.getPlaceType() != null) place.setPlaceType(req.getPlaceType());
        place.setCenterLat(req.getCenterLat());
        place.setCenterLng(req.getCenterLng());
        if (req.getRadiusMeters() != null) place.setRadiusMeters(req.getRadiusMeters());

        place = namedPlaceRepository.save(place);
        return toResponse(place);
    }

    @Transactional
    public void deleteNamedPlace(UUID id) {
        NamedPlace place = namedPlaceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Named place not found: " + id));
        namedPlaceRepository.delete(place);
        log.info("Deleted named place {}", id);
    }

    private NamedPlaceResponse toResponse(NamedPlace p) {
        return NamedPlaceResponse.builder()
                .id(p.getId())
                .profileId(p.getProfileId())
                .name(p.getName())
                .placeType(p.getPlaceType())
                .centerLat(p.getCenterLat())
                .centerLng(p.getCenterLng())
                .radiusMeters(p.getRadiusMeters())
                .isActive(p.getIsActive())
                .build();
    }
}
