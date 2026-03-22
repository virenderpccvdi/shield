package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.profile.dto.response.EmergencyContactResponse;
import com.rstglobal.shield.profile.service.EmergencyContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Internal endpoint — called by shield-location SosService to fetch emergency contacts.
 * Not exposed through the API gateway.
 */
@RestController
@RequestMapping("/internal/profiles")
@RequiredArgsConstructor
public class InternalEmergencyContactController {

    private final EmergencyContactService service;

    @GetMapping("/{profileId}/emergency-contacts")
    public List<EmergencyContactResponse> getContacts(@PathVariable UUID profileId) {
        return service.getAll(profileId);
    }
}
