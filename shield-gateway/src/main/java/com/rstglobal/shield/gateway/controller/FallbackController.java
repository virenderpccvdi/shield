package com.rstglobal.shield.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Circuit-breaker fallback endpoints.
 * Must handle ALL HTTP methods (GET, POST, PUT, DELETE, PATCH) — if this only
 * handles GET, Spring WebFlux returns 405 when a POST/PUT triggers the fallback.
 */
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @RequestMapping(value = "/service-unavailable", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<Map<String, Object>>> serviceUnavailable() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "success", false,
                "error", "SERVICE_UNAVAILABLE",
                "message", "The requested service is temporarily unavailable. Please try again shortly."
        )));
    }
}
