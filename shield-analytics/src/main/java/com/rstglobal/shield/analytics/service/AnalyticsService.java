package com.rstglobal.shield.analytics.service;

import com.rstglobal.shield.analytics.dto.request.BulkLogIngestRequest;
import com.rstglobal.shield.analytics.dto.request.LogIngestRequest;
import com.rstglobal.shield.analytics.dto.response.AppUsageEntry;
import com.rstglobal.shield.analytics.dto.response.CategoryBreakdown;
import com.rstglobal.shield.analytics.dto.response.CustomersSummaryResponse;
import com.rstglobal.shield.analytics.dto.response.DailyUsagePoint;
import com.rstglobal.shield.analytics.dto.response.HourlyUsagePoint;
import com.rstglobal.shield.analytics.dto.response.TopAppEntry;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
            String rootDomain = extractRootDomain(domain);
            String appName = resolveAppName(rootDomain);
            result.add(new TopDomainEntry(domain, count, act, rootDomain, appName, null));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<TopAppEntry> getTopApps(UUID profileId, String period) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findTopDomainsByProfileId(
                profileId, range[0], range[1], 200);

        // Aggregate by appName (for known apps) or rootDomain for everything else
        Map<String, long[]> appCounts = new HashMap<>();
        Map<String, String> appToRoot = new HashMap<>();

        for (Object[] row : rows) {
            String domain = (String) row[0];
            long count = ((Number) row[1]).longValue();
            String rootDomain = extractRootDomain(domain);
            String appName = resolveAppName(rootDomain);
            if (appName == null) continue; // skip unknown apps in top-apps view

            appCounts.computeIfAbsent(appName, k -> new long[]{0})[0] += count;
            appToRoot.putIfAbsent(appName, rootDomain);
        }

        List<TopAppEntry> result = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : appCounts.entrySet()) {
            result.add(new TopAppEntry(entry.getKey(), appToRoot.get(entry.getKey()), entry.getValue()[0]));
        }
        result.sort(Comparator.comparingLong(TopAppEntry::getCount).reversed());
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

    @Transactional(readOnly = true)
    public List<TopDomainEntry> getTenantTopBlockedDomains(UUID tenantId, String period, int limit) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findTenantTopBlockedDomains(
                tenantId, range[0], range[1], limit);
        List<TopDomainEntry> result = new ArrayList<>();
        for (Object[] row : rows) {
            String domain = (String) row[0];
            String category = (String) row[1];
            long count = ((Number) row[2]).longValue();
            String rootDomain = extractRootDomain(domain);
            String appName = resolveAppName(rootDomain);
            result.add(new TopDomainEntry(domain, count, "BLOCKED", rootDomain, appName, category));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public CustomersSummaryResponse getCustomersSummary() {
        Instant sevenDaysAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        Instant monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        Object[] row = dnsQueryLogRepository.findCustomersSummary(sevenDaysAgo);
        long totalCustomers = row != null && row[0] != null ? ((Number) row[0]).longValue() : 0L;
        long activeCustomers = row != null && row[1] != null ? ((Number) row[1]).longValue() : 0L;
        long newThisMonth = dnsQueryLogRepository.countNewProfilesSince(monthStart);
        long profilesProtected = dnsQueryLogRepository.countDistinctProfiles();

        return new CustomersSummaryResponse(totalCustomers, activeCustomers, newThisMonth, profilesProtected);
    }

    @Transactional(readOnly = true)
    public List<HourlyUsagePoint> getTenantHourlyBreakdown(UUID tenantId, String date) {
        List<Object[]> rows = dnsQueryLogRepository.findTenantHourlyBreakdown(tenantId, date);
        return buildHourlyPoints(rows);
    }

    @Transactional(readOnly = true)
    public List<HourlyUsagePoint> getProfileHourlyBreakdown(UUID profileId, String date) {
        List<Object[]> rows = dnsQueryLogRepository.findHourlyBreakdownByProfileId(profileId, date);
        return buildHourlyPoints(rows);
    }

    private List<HourlyUsagePoint> buildHourlyPoints(List<Object[]> rows) {
        // Build a map hour → count from query results
        Map<Integer, Long> hourMap = new HashMap<>();
        for (Object[] row : rows) {
            int hour = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            hourMap.put(hour, count);
        }
        // Return all 24 hours (fill with 0 if no data)
        List<HourlyUsagePoint> result = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            result.add(new HourlyUsagePoint(h, hourMap.getOrDefault(h, 0L)));
        }
        return result;
    }

    // ── CS-06: App Usage Report ──────────────────────────────────────────────

    /**
     * Returns an app-level usage breakdown for a child profile in the given period.
     * Groups DNS queries by resolved app name. Unrecognised domains are placed in an
     * "Other" bucket. Returns top 20 apps + Other, sorted by total query count.
     *
     * @param profileId child profile UUID
     * @param period    "day", "week", or "month"
     * @return list of AppUsageEntry (max 21 entries: 20 named apps + Other)
     */
    @Transactional(readOnly = true)
    public List<AppUsageEntry> getAppUsageReport(UUID profileId, String period) {
        Instant[] range = periodToRange(period);
        List<Object[]> rows = dnsQueryLogRepository.findDomainAggregatesForProfile(
                profileId, range[0], range[1]);

        // Map: appName → [totalCount, blockedCount, uniqueDomains]
        Map<String, long[]> appData = new HashMap<>();
        Map<String, String> appToRoot = new HashMap<>();

        long otherTotal = 0;
        long otherBlocked = 0;
        long otherUnique = 0;

        for (Object[] row : rows) {
            String domain = (String) row[0];
            long total = ((Number) row[1]).longValue();
            long blocked = ((Number) row[2]).longValue();

            String rootDomain = extractRootDomain(domain);
            String appName = resolveAppName(rootDomain);

            if (appName != null) {
                long[] data = appData.computeIfAbsent(appName, k -> new long[]{0, 0, 0});
                data[0] += total;
                data[1] += blocked;
                data[2] += 1; // unique sub-domains
                appToRoot.putIfAbsent(appName, rootDomain);
            } else {
                otherTotal += total;
                otherBlocked += blocked;
                otherUnique += 1;
            }
        }

        // Build sorted list
        List<AppUsageEntry> result = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : appData.entrySet()) {
            long[] d = entry.getValue();
            result.add(new AppUsageEntry(
                    entry.getKey(),
                    appToRoot.get(entry.getKey()),
                    d[0], d[1], d[2],
                    d[0] * 30L,
                    false));
        }
        result.sort(Comparator.comparingLong(AppUsageEntry::getQueryCount).reversed());

        // Keep top 20
        if (result.size() > 20) {
            result = result.subList(0, 20);
        }

        // Append "Other" bucket if there were unrecognised domains
        if (otherTotal > 0) {
            result.add(new AppUsageEntry(
                    "Other", null,
                    otherTotal, otherBlocked, otherUnique,
                    otherTotal * 30L,
                    true));
        }

        return result;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Known domain → app name mapping. Keys are root domains (no www). */
    private static final Map<String, String> KNOWN_APPS = Map.ofEntries(
            Map.entry("youtube.com",   "YouTube"),
            Map.entry("ytimg.com",     "YouTube"),
            Map.entry("googlevideo.com", "YouTube"),
            Map.entry("instagram.com", "Instagram"),
            Map.entry("cdninstagram.com", "Instagram"),
            Map.entry("tiktok.com",    "TikTok"),
            Map.entry("tiktokcdn.com", "TikTok"),
            Map.entry("musical.ly",    "TikTok"),
            Map.entry("facebook.com",  "Facebook"),
            Map.entry("fbcdn.net",     "Facebook"),
            Map.entry("messenger.com", "Facebook"),
            Map.entry("twitter.com",   "Twitter/X"),
            Map.entry("x.com",         "Twitter/X"),
            Map.entry("twimg.com",     "Twitter/X"),
            Map.entry("snapchat.com",  "Snapchat"),
            Map.entry("snap.com",      "Snapchat"),
            Map.entry("sc-cdn.net",    "Snapchat"),
            Map.entry("roblox.com",    "Roblox"),
            Map.entry("robloxlabs.com","Roblox"),
            Map.entry("discord.com",   "Discord"),
            Map.entry("discordapp.com","Discord"),
            Map.entry("whatsapp.com",  "WhatsApp"),
            Map.entry("whatsapp.net",  "WhatsApp"),
            Map.entry("netflix.com",   "Netflix"),
            Map.entry("nflxvideo.net", "Netflix"),
            Map.entry("nflximg.net",   "Netflix")
    );

    /**
     * Extracts the root domain (eTLD+1) from a fully qualified domain name.
     * - Strips leading "www."
     * - Returns the last two labels (e.g. s.ytimg.com → ytimg.com)
     * - Single-label or empty input is returned as-is.
     */
    public static String extractRootDomain(String domain) {
        if (domain == null || domain.isBlank()) return domain;
        // Strip trailing dot (FQDN notation)
        String d = domain.endsWith(".") ? domain.substring(0, domain.length() - 1) : domain;
        // Strip leading www.
        if (d.startsWith("www.")) {
            d = d.substring(4);
        }
        // Return last two labels
        int lastDot = d.lastIndexOf('.');
        if (lastDot <= 0) return d; // already a root or single label
        int secondLastDot = d.lastIndexOf('.', lastDot - 1);
        if (secondLastDot < 0) return d; // already two-label (e.g. youtube.com)
        return d.substring(secondLastDot + 1);
    }

    /**
     * Resolves a root domain to a known app name, or null if unknown.
     */
    public static String resolveAppName(String rootDomain) {
        if (rootDomain == null) return null;
        return KNOWN_APPS.get(rootDomain.toLowerCase());
    }

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
