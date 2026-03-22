package com.rstglobal.shield.analytics.controller;

import com.rstglobal.shield.analytics.service.ExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * IS-05: ISP Analytics Export endpoints.
 *
 * <pre>
 * GET /api/v1/analytics/export/dns?tenantId=&period=WEEK&format=CSV
 * GET /api/v1/analytics/export/customers?tenantId=&format=CSV
 * </pre>
 *
 * Access is restricted to GLOBAL_ADMIN or the ISP_ADMIN that owns the tenant.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/analytics/export")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;

    /**
     * Export daily DNS stats + top-10 blocked domains for a tenant.
     *
     * @param tenantId      the tenant to export data for
     * @param period        TODAY | WEEK | MONTH | ALL  (default: WEEK)
     * @param format        CSV | JSON  (default: CSV)
     * @param role          injected by gateway: X-User-Role
     * @param headerTenantId injected by gateway: X-Tenant-Id (ISP admin's own tenant)
     */
    @GetMapping("/dns")
    public ResponseEntity<byte[]> exportDns(
            @RequestParam UUID tenantId,
            @RequestParam(defaultValue = "WEEK") String period,
            @RequestParam(defaultValue = "CSV") String format,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {

        requireAdminOrMatchingTenant(role, headerTenantId, tenantId);
        validateFormat(format);
        validatePeriod(period);

        log.info("DNS export requested — tenantId={} period={} format={}", tenantId, period, format);

        byte[] data = exportService.exportDnsStats(tenantId, period, format);

        String ext         = resolveExtension(format);
        String contentType = resolveContentType(format);
        String filename    = "shield-dns-export." + ext;

        return ResponseEntity.ok()
                .header("Content-Type", contentType + "; charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("Content-Length", String.valueOf(data.length))
                .body(data);
    }

    /**
     * Export per-profile customer usage summary for a tenant.
     *
     * @param tenantId       the tenant to export data for
     * @param format         CSV | JSON  (default: CSV)
     * @param role           injected by gateway: X-User-Role
     * @param headerTenantId injected by gateway: X-Tenant-Id (ISP admin's own tenant)
     */
    @GetMapping("/customers")
    public ResponseEntity<byte[]> exportCustomers(
            @RequestParam UUID tenantId,
            @RequestParam(defaultValue = "CSV") String format,
            @RequestHeader("X-User-Role") String role,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {

        requireAdminOrMatchingTenant(role, headerTenantId, tenantId);
        validateFormat(format);

        log.info("Customer summary export requested — tenantId={} format={}", tenantId, format);

        byte[] data = exportService.exportCustomerSummary(tenantId, format);

        String ext         = resolveExtension(format);
        String contentType = resolveContentType(format);
        String filename    = "shield-customers-export." + ext;

        return ResponseEntity.ok()
                .header("Content-Type", contentType + "; charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("Content-Length", String.valueOf(data.length))
                .body(data);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void requireAdminOrMatchingTenant(String role, String headerTenantId, UUID tenantId) {
        if ("GLOBAL_ADMIN".equalsIgnoreCase(role)) return;
        if ("ISP_ADMIN".equalsIgnoreCase(role) && headerTenantId != null && !headerTenantId.isBlank()) {
            try {
                if (UUID.fromString(headerTenantId).equals(tenantId)) return;
            } catch (IllegalArgumentException ignored) {
                // fall through to 403
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Access denied: GLOBAL_ADMIN or ISP_ADMIN of matching tenant required");
    }

    private void validateFormat(String format) {
        if (!"CSV".equalsIgnoreCase(format) && !"JSON".equalsIgnoreCase(format)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid format '" + format + "'. Allowed values: CSV, JSON");
        }
    }

    private void validatePeriod(String period) {
        if (!"TODAY".equalsIgnoreCase(period)
                && !"WEEK".equalsIgnoreCase(period)
                && !"MONTH".equalsIgnoreCase(period)
                && !"ALL".equalsIgnoreCase(period)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid period '" + period + "'. Allowed values: TODAY, WEEK, MONTH, ALL");
        }
    }

    private String resolveExtension(String format) {
        return "JSON".equalsIgnoreCase(format) ? "json" : "csv";
    }

    private String resolveContentType(String format) {
        return "JSON".equalsIgnoreCase(format) ? "application/json" : "text/csv";
    }
}
