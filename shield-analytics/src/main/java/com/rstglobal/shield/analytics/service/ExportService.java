package com.rstglobal.shield.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * IS-05: ISP Analytics Export — produces CSV or JSON byte arrays for download.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final DnsQueryLogRepository dnsQueryLogRepository;
    private final ObjectMapper objectMapper;

    // ── DNS stats export ──────────────────────────────────────────────────────

    /**
     * Export daily DNS stats for a tenant plus the top-10 blocked domains in the period.
     *
     * @param tenantId tenant UUID
     * @param period   TODAY | WEEK | MONTH | ALL
     * @param format   CSV | JSON
     * @return serialised bytes ready to send as a download
     */
    @Transactional(readOnly = true)
    public byte[] exportDnsStats(UUID tenantId, String period, String format) {
        Instant[] range = periodToRange(period);
        Instant from = range[0];
        Instant to   = range[1];

        // Daily breakdown rows: [date, total, blocked]
        List<Object[]> dailyRows = dnsQueryLogRepository.findTenantDailyBreakdown(tenantId, from);

        // Top-10 blocked domains for the whole period: [domain, category, count]
        List<Object[]> topRows = dnsQueryLogRepository.findTenantTopBlockedDomains(tenantId, from, to, 10);

        // Build a quick lookup: domain → count string for the daily rows annotation
        // The top domains are reported as a separate section / extra columns
        List<Map<String, Object>> dailyData = new ArrayList<>();
        for (Object[] row : dailyRows) {
            LocalDate date = row[0] instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) row[0];
            long total   = ((Number) row[1]).longValue();
            long blocked = ((Number) row[2]).longValue();
            long allowed = total - blocked;

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("date", date.toString());
            entry.put("totalQueries", total);
            entry.put("blockedQueries", blocked);
            entry.put("allowedQueries", allowed);
            dailyData.add(entry);
        }

        List<Map<String, Object>> topDomainData = new ArrayList<>();
        for (Object[] row : topRows) {
            String domain   = (String) row[0];
            String category = row[1] != null ? (String) row[1] : "";
            long   count    = ((Number) row[2]).longValue();

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("domain", domain);
            entry.put("category", category);
            entry.put("blockedQueries", count);
            topDomainData.add(entry);
        }

        if ("JSON".equalsIgnoreCase(format)) {
            return toJsonBytes(Map.of(
                    "tenantId", tenantId.toString(),
                    "period", period.toUpperCase(),
                    "dailyStats", dailyData,
                    "topBlockedDomains", topDomainData
            ));
        }

        // CSV: two sections separated by a blank line
        StringBuilder sb = new StringBuilder();

        // Section 1 — daily stats
        sb.append("# DNS Daily Stats — tenantId=").append(tenantId)
          .append(" period=").append(period.toUpperCase()).append("\n");
        sb.append("date,totalQueries,blockedQueries,allowedQueries\n");
        for (Map<String, Object> row : dailyData) {
            sb.append(row.get("date")).append(",")
              .append(row.get("totalQueries")).append(",")
              .append(row.get("blockedQueries")).append(",")
              .append(row.get("allowedQueries")).append("\n");
        }

        sb.append("\n");

        // Section 2 — top 10 blocked domains
        sb.append("# Top 10 Blocked Domains\n");
        sb.append("domain,category,blockedQueries\n");
        for (Map<String, Object> row : topDomainData) {
            sb.append(csvEscape(row.get("domain").toString())).append(",")
              .append(csvEscape(row.get("category").toString())).append(",")
              .append(row.get("blockedQueries")).append("\n");
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ── Customer summary export ───────────────────────────────────────────────

    /**
     * Export per-profile customer summary for a tenant.
     *
     * @param tenantId tenant UUID
     * @param format   CSV | JSON
     * @return serialised bytes ready to send as a download
     */
    @Transactional(readOnly = true)
    public byte[] exportCustomerSummary(UUID tenantId, String format) {
        // Aggregate stats per profile within the tenant (all-time)
        List<Object[]> rows = dnsQueryLogRepository.findCustomerSummaryByTenant(tenantId);

        List<Map<String, Object>> data = new ArrayList<>();
        for (Object[] row : rows) {
            UUID profileId   = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
            long total       = ((Number) row[1]).longValue();
            long blocked     = ((Number) row[2]).longValue();
            double blockPct  = total > 0 ? Math.round(((double) blocked / total * 100.0) * 10.0) / 10.0 : 0.0;
            Instant lastSeen = row[3] != null
                    ? (row[3] instanceof Instant i ? i : ((java.sql.Timestamp) row[3]).toInstant())
                    : null;

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("profileId", profileId.toString());
            entry.put("totalQueries", total);
            entry.put("blockedQueries", blocked);
            entry.put("allowedQueries", total - blocked);
            entry.put("blockedPercent", blockPct);
            entry.put("lastActivity", lastSeen != null ? lastSeen.toString() : "");
            data.add(entry);
        }

        if ("JSON".equalsIgnoreCase(format)) {
            return toJsonBytes(Map.of(
                    "tenantId", tenantId.toString(),
                    "customers", data
            ));
        }

        // CSV
        StringBuilder sb = new StringBuilder();
        sb.append("# Customer Summary — tenantId=").append(tenantId).append("\n");
        sb.append("profileId,totalQueries,blockedQueries,allowedQueries,blockedPercent,lastActivity\n");
        for (Map<String, Object> row : data) {
            sb.append(row.get("profileId")).append(",")
              .append(row.get("totalQueries")).append(",")
              .append(row.get("blockedQueries")).append(",")
              .append(row.get("allowedQueries")).append(",")
              .append(row.get("blockedPercent")).append(",")
              .append(row.get("lastActivity")).append("\n");
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private byte[] toJsonBytes(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(value);
        } catch (Exception e) {
            log.error("JSON serialisation failed", e);
            return "{}".getBytes(StandardCharsets.UTF_8);
        }
    }

    /** Wrap a CSV field in double-quotes if it contains commas, quotes, or newlines. */
    private String csvEscape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private Instant[] periodToRange(String period) {
        Instant now = Instant.now();
        Instant from = switch (period == null ? "WEEK" : period.toUpperCase()) {
            case "TODAY" -> now.truncatedTo(ChronoUnit.DAYS);
            case "MONTH" -> now.minus(30, ChronoUnit.DAYS);
            case "ALL"   -> Instant.EPOCH;
            default      -> now.minus(7, ChronoUnit.DAYS); // WEEK
        };
        return new Instant[]{from, now};
    }
}
