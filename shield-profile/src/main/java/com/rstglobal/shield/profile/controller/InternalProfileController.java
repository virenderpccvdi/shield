package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.profile.entity.ChildProfile;
import com.rstglobal.shield.profile.entity.Customer;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

/**
 * Internal endpoints — NOT exposed through the gateway.
 * Called only by other Shield microservices via Eureka-resolved URLs.
 */
@Slf4j
@RestController
@RequestMapping("/internal/profiles")
@RequiredArgsConstructor
public class InternalProfileController {

    private final ChildProfileRepository childProfileRepository;
    private final CustomerRepository customerRepository;

    /**
     * Returns the parent (customer) userId and tenantId for a given child profileId.
     * Used by shield-location SosService to route SOS notifications to the correct parent.
     *
     * @param profileId the child profile UUID
     * @return map containing userId, tenantId, name, email of the parent customer
     */
    @GetMapping("/{profileId}/parent")
    public Map<String, Object> getParentByProfileId(@PathVariable UUID profileId) {
        ChildProfile profile = childProfileRepository.findById(profileId)
                .orElseThrow(() -> {
                    log.warn("Internal: child profile not found for profileId={}", profileId);
                    return new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Child profile not found: " + profileId);
                });

        Customer customer = customerRepository.findById(profile.getCustomerId())
                .orElseThrow(() -> {
                    log.warn("Internal: customer not found for customerId={}", profile.getCustomerId());
                    return new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Customer not found for profile: " + profileId);
                });

        return Map.of(
                "userId", customer.getUserId().toString(),
                "tenantId", customer.getTenantId() != null
                        ? customer.getTenantId().toString()
                        : "00000000-0000-0000-0000-000000000000",
                "name", customer.getName() != null ? customer.getName() : "",
                "email", customer.getEmail() != null ? customer.getEmail() : "",
                "childName", profile.getName()
        );
    }
}
