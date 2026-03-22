package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.profile.dto.request.EmergencyContactRequest;
import com.rstglobal.shield.profile.dto.response.EmergencyContactResponse;
import com.rstglobal.shield.profile.service.EmergencyContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/{profileId}/emergency-contacts")
@RequiredArgsConstructor
public class EmergencyContactController {

    private final EmergencyContactService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EmergencyContactResponse>>> getAll(
            @PathVariable UUID profileId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getAll(profileId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EmergencyContactResponse>> add(
            @PathVariable UUID profileId,
            @Valid @RequestBody EmergencyContactRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(service.add(profileId, req)));
    }

    @DeleteMapping("/{contactId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID profileId,
            @PathVariable UUID contactId) {
        service.delete(profileId, contactId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Contact deleted"));
    }
}
