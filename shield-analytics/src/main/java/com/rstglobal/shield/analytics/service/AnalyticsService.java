package com.rstglobal.shield.analytics.service;

import com.rstglobal.shield.analytics.dto.request.BulkLogIngestRequest;
import com.rstglobal.shield.analytics.dto.request.LogIngestRequest;
import com.rstglobal.shield.analytics.dto.response.CategoryBreakdown;
import com.rstglobal.shield.analytics.dto.response.DailyUsagePoint;
import com.rstglobal.shield.analytics.dto.response.TopDomainEntry;
import com.rstglobal.shield.analytics.dto.response.UsageStatsResponse;
import com.rstglobal.shield.analytics.entity.DnsQueryLog;
import com.rstglobal.shield.analytics.entity.UsageSummary;
import com.rstglobal.shield.analytics.repository.DnsQueryLogRepository;
import com.rstglobal.shield.analytics.repository.UsageSummaryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final DnsQueryLogRepository dnsQueryLogRepository;
    private final UsageSummaryRepository usageSummaryRepository;

    @Transactional
    public DnsQueryLog ingestLog(LogIngestRequest req) {
        DnsQueryLog log = new DnsQueryLog();
        log.setTenantId(req.getTenantId());
        log.setProfileId(req.getProfileId());
        log.setDeviceId(req.getDeviceId());
        log.setDomain(req.getDomain());
        log.setAction(req.getAction());
        log.setCategory(req.getCategory());
        log.setClientIp(req.getClientIp());
        log.setQueriedAt(req.getQueriedAt() != null ? req.getQueriedAt() : Instant.now());
        return dnsQueryLogRepository.save(log);
    }

    @Transactional
    public List<DnsQueryLog> ingestBulk(BulkLogIngestRequest req) {
        List<DnsQueryLog> entities = new ArrayList<>();
        for (LogIngestRequest r : req.getLogs()) {
            DnsQueryLog entry = new DnsQueryLog();
            entry.setTenantId(r.getTenantId());
            entry.setProfileId(r.getProfileId());
            entry.setDeviceId(r.getDeviceId());
            entry.setDomain(r.getDomain());
            entry.setAction(r.getAction());
            entry.setCategory(r.getCategory());
            entry.setClientIp(r.getClientIp());
            entry.setQueriedAt(r.getQueriedAt() != null ? r.getQueriedAt() : Instant.now());
            entities.add(entry);
        }
        return dnsQueryLogRepository.saveAll(entities);
    }

    @Transactional(readOnly = true)
    public UsageStatsResponse getUsageStats(UUID profileId, String period) {
        Instant[] range = periodToRange(period);
        Instant from = range[0];
        Instant to = range[1];

        long total = dnsQueryLogRepository.countByProfileIdAndQueriedAtBetween(profileId, from, to);
        long blocked = dnsQueryLogRepository.countByProfileIdAndActionAndQueriedAtBetween(profileId, "BLOCKED", from, to);
        long allowed = dnsQueryLogRepository.countByProfileIdAndActionAndQueriedAtBetween(profileId, "ALLOWED", from, to);
        double blockRate = total > 0 ? (double) blocked / total * 100.0 : 0.0;

        return new UsageStatsResponse(profileId, period, total, blocked, allowed, blockRate);
    }

    @Transactional(readOnly = true)
    public List<TopDomainEntry> getTopDomains(UUID profileId, String action, int limit, String period) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findTopDomainsByProfileIdAndAction(
                profileId, action, range[0], range[1], limit);

        List<TopDomainEntry> result = new ArrayList<>();
        for (Object[] row : rows) {
            String domain = (String) row[0];
            long count = ((Number) row[1]).longValue();
            String act = (String) row[2];
            result.add(new TopDomainEntry(domain, count, act));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<DailyUsagePoint> getDailyBreakdown(UUID profileId, int days) {
        Instant from = Instant.now().minus(days, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        List<Object[]> rows = dnsQueryLogRepository.findDailyBreakdownByProfileId(profileId, from);

        List<DailyUsagePoint> result = new ArrayList<>();
        for (Object[] row : rows) {
            LocalDate date = row[0] instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) row[0];
            long total = ((Number) row[1]).longValue();
            long blocked = ((Number) row[2]).longValue();
            result.add(new DailyUsagePoint(date, total, blocked));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<CategoryBreakdown> getCategoryBreakdown(UUID profileId, String period) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findCategoryBreakdownByProfileId(
                profileId, range[0], range[1]);

        List<CategoryBreakdown> result = new ArrayList<>();
        for (Object[] row : rows) {
            String category = (String) row[0];
            long count = ((Number) row[1]).longValue();
            result.add(new CategoryBreakdown(category, count));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Page<DnsQueryLog> getBrowsingHistory(UUID profileId, String action, Pageable pageable) {
        Instant from = Instant.EPOCH;
        Instant to = Instant.now();
        if (action != null && (action.equals("BLOCKED") || action.equals("ALLOWED"))) {
            return dnsQueryLogRepository.findByProfileIdAndActionAndQueriedAtBetween(
                    profileId, action, from, to, pageable);
        }
        return dnsQueryLogRepository.findByProfileIdAndQueriedAtBetween(profileId, from, to, pageable);
    }

    @Transactional
    public UsageSummary generateDailySummary(UUID profileId, LocalDate date) {
        Instant from = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        long total = dnsQueryLogRepository.countByProfileIdAndQueriedAtBetween(profileId, from, to);
        long blocked = dnsQueryLogRepository.countByProfileIdAndActionAndQueriedAtBetween(profileId, "BLOCKED", from, to);
        long allowed = dnsQueryLogRepository.countByProfileIdAndActionAndQueriedAtBetween(profileId, "ALLOWED", from, to);

        UsageSummary summary = usageSummaryRepository
                .findByProfileIdAndSummaryDate(profileId, date)
                .orElse(new UsageSummary());

        summary.setProfileId(profileId);
        summary.setSummaryDate(date);
        summary.setTotalQueries(total);
        summary.setBlockedQueries(blocked);
        summary.setAllowedQueries(allowed);

        return usageSummaryRepository.save(summary);
    }

    // ── platform-wide (admin) ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UsageStatsResponse getPlatformOverview(String period) {
        Instant[] range = periodToRange(period);
        long total = dnsQueryLogRepository.countByQueriedAtBetween(range[0], range[1]);
        long blocked = dnsQueryLogRepository.countByActionAndQueriedAtBetween("BLOCKED", range[0], range[1]);
        long allowed = total - blocked;
        double blockRate = total > 0 ? (double) blocked / total * 100.0 : 0.0;
        return new UsageStatsResponse(null, period, total, blocked, allowed, blockRate);
    }

    @Transactional(readOnly = true)
    public List<DailyUsagePoint> getPlatformDailyBreakdown(int days) {
        Instant from = Instant.now().minus(days, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        List<Object[]> rows = dnsQueryLogRepository.findPlatformDailyBreakdown(from);
        List<DailyUsagePoint> result = new ArrayList<>();
        for (Object[] row : rows) {
            LocalDate date = row[0] instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) row[0];
            long total = ((Number) row[1]).longValue();
            long blockedCount = ((Number) row[2]).longValue();
            result.add(new DailyUsagePoint(date, total, blockedCount));
        }
        return result;
    }

    // ── tenant-scoped (ISP admin) ────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UsageStatsResponse getTenantOverview(UUID tenantId, String period) {
        Instant[] range = periodToRange(period);
        long total = dnsQueryLogRepository.countByTenantIdAndQueriedAtBetween(tenantId, range[0], range[1]);
        long blocked = dnsQueryLogRepository.countByTenantIdAndActionAndQueriedAtBetween(tenantId, "BLOCKED", range[0], range[1]);
        long allowed = total - blocked;
        double blockRate = total > 0 ? (double) blocked / total * 100.0 : 0.0;
        return new UsageStatsResponse(null, period, total, blocked, allowed, blockRate);
    }

    @Transactional(readOnly = true)
    public List<DailyUsagePoint> getTenantDailyBreakdown(UUID tenantId, int days) {
        Instant from = Instant.now().minus(days, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        List<Object[]> rows = dnsQueryLogRepository.findTenantDailyBreakdown(tenantId, from);
        List<DailyUsagePoint> result = new ArrayList<>();
        for (Object[] row : rows) {
            LocalDate date = row[0] instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) row[0];
            long total = ((Number) row[1]).longValue();
            long blockedCount = ((Number) row[2]).longValue();
            result.add(new DailyUsagePoint(date, total, blockedCount));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<CategoryBreakdown> getTenantBlockedCategories(UUID tenantId, String period) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findTenantBlockedCategories(tenantId, range[0], range[1]);
        List<CategoryBreakdown> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(new CategoryBreakdown((String) row[0], ((Number) row[1]).longValue()));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<CategoryBreakdown> getPlatformBlockedCategories(String period) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findPlatformBlockedCategories(range[0], range[1]);
        List<CategoryBreakdown> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(new CategoryBreakdown((String) row[0], ((Number) row[1]).longValue()));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Object[]> getTopTenantsByQueries(String period, int limit) {
        Instant[] range = periodToRange(period);
        return dnsQueryLogRepository.findTopTenantsByQueries(range[0], range[1], limit);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Instant[] periodToRange(String period) {
        Instant now = Instant.now();
        Instant from = switch (period == null ? "today" : period.toLowerCase()) {
            case "week" -> now.minus(7, ChronoUnit.DAYS);
            case "month" -> now.minus(30, ChronoUnit.DAYS);
            default -> now.truncatedTo(ChronoUnit.DAYS); // today
        };
        return new Instant[]{from, now};
    }
}
