package com.rstglobal.shield.analytics.controller;

import com.rstglobal.shield.analytics.dto.request.BulkLogIngestRequest;
import com.rstglobal.shield.analytics.dto.request.LogIngestRequest;
import com.rstglobal.shield.analytics.entity.DnsQueryLog;
import com.rstglobal.shield.analytics.service.AnalyticsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Internal endpoints called by DNS service / AdGuard webhook.
 * No authentication required — secured at network level (internal only).
 */
@Slf4j
@RestController
@RequestMapping("/internal/analytics")
@RequiredArgsConstructor
public class InternalAnalyticsController {

    private final AnalyticsService analyticsService;

    /**
     * POST /internal/analytics/log
     * Ingest a single DNS query log entry.
     */
    @PostMapping("/log")
    public ResponseEntity<Map<String, Object>> ingestLog(@Valid @RequestBody LogIngestRequest request) {
        log.debug("Ingesting single log for profileId={} domain={} action={}",
                request.getProfileId(), request.getDomain(), request.getAction());
        DnsQueryLog saved = analyticsService.ingestLog(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("id", saved.getId(), "status", "ingested"));
    }

    /**
     * POST /internal/analytics/log/bulk
     * Bulk ingest DNS query log entries.
     */
    @PostMapping("/log/bulk")
    public ResponseEntity<Map<String, Object>> ingestBulk(@Valid @RequestBody BulkLogIngestRequest request) {
        log.debug("Bulk ingesting {} log entries", request.getLogs().size());
        List<DnsQueryLog> saved = analyticsService.ingestBulk(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("ingested", saved.size(), "status", "ok"));
    }
}
