package com.rstglobal.shield.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Circuit-breaker fallback endpoints.
 * Downstream services return a 503 with a JSON body when a circuit is open.
 */
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping(value = "/service-unavailable", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<Map<String, Object>> serviceUnavailable() {
        return Mono.just(Map.of(
                "success", false,
                "error", "SERVICE_UNAVAILABLE",
                "message", "The requested service is temporarily unavailable. Please try again shortly."
        ));
    }
}
