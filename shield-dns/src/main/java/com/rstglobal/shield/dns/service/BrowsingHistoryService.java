package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.dns.dto.response.BrowsingHistoryResponse;
import com.rstglobal.shield.dns.dto.response.BrowsingStatsResponse;
import com.rstglobal.shield.dns.entity.BrowsingHistory;
import com.rstglobal.shield.dns.repository.BrowsingHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * PO-02: Safe Browsing History — business logic.
 *
 * <p>DNS query events are written via {@link #recordQuery} (called from the
 * internal endpoint that AdGuard or the filter engine posts to).
 * Parents retrieve history and statistics through {@link #getHistory} and
 * {@link #getStats}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BrowsingHistoryService {

    private final BrowsingHistoryRepository repo;

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Persist a single DNS query event.
     *
     * @param profileId child profile UUID
     * @param tenantId  tenant UUID
     * @param domain    queried domain (e.g. "youtube.com")
     * @param blocked   whether the query was blocked
     * @param category  content category (may be null)
     * @param queryType DNS record type, e.g. "A" (may be null, defaults to "A")
     * @param clientIp  querying device IP (may be null)
     */
    @Transactional
    public void recordQuery(UUID profileId, UUID tenantId, String domain,
                            boolean blocked, String category,
                            String queryType, String clientIp) {
        BrowsingHistory entry = BrowsingHistory.builder()
                .profileId(profileId)
                .tenantId(tenantId)
                .domain(domain)
                .wasBlocked(blocked)
                .category(category)
                .queryType(queryType != null ? queryType : "A")
                .clientIp(clientIp)
                .queriedAt(OffsetDateTime.now())
                .build();
        repo.save(entry);
        log.debug("Recorded DNS query: profileId={} domain={} blocked={}", profileId, domain, blocked);
    }

    // ── Read history ──────────────────────────────────────────────────────────

    /**
     * Retrieve paginated browsing history for a child profile.
     *
     * @param profileId   child profile UUID
     * @param page        zero-based page number
     * @param size        page size (max 200 capped internally)
     * @param blockedOnly when non-null, filters to only blocked (true) or allowed (false) queries
     * @param period      one of "TODAY", "WEEK", "MONTH", or null (all time)
     * @return paginated history entries, newest first
     */
    @Transactional(readOnly = true)
    public Page<BrowsingHistoryResponse> getHistory(UUID profileId, int page, int size,
                                                     Boolean blockedOnly, String period) {
        int cappedSize = Math.min(size, 200);
        Pageable pageable = PageRequest.of(page, cappedSize);
        OffsetDateTime after = periodStart(period);

        Page<BrowsingHistory> raw;

        if (after != null && blockedOnly != null) {
            raw = repo.findByProfileIdAndWasBlockedAndQueriedAtAfterOrderByQueriedAtDesc(
                    profileId, blockedOnly, after, pageable);
        } else if (after != null) {
            raw = repo.findByProfileIdAndQueriedAtAfterOrderByQueriedAtDesc(profileId, after, pageable);
        } else if (blockedOnly != null) {
            raw = repo.findByProfileIdAndWasBlockedOrderByQueriedAtDesc(profileId, blockedOnly, pageable);
        } else {
            raw = repo.findByProfileIdOrderByQueriedAtDesc(profileId, pageable);
        }

        return raw.map(this::toResponse);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    /**
     * Compute today's summary statistics for a child profile.
     *
     * @param profileId child profile UUID
     * @return totals and top-domain list for today
     */
    @Transactional(readOnly = true)
    public BrowsingStatsResponse getStats(UUID profileId) {
        OffsetDateTime startOfDay = todayStart();

        long blockedToday = repo.countByProfileIdAndWasBlockedAndQueriedAtAfter(
                profileId, true, startOfDay);
        long totalToday = repo.countByProfileIdAndQueriedAtAfter(profileId, startOfDay);
        long allowedToday = totalToday - blockedToday;

        // Top 10 domains queried today
        Pageable top10 = PageRequest.of(0, 10);
        List<Object[]> rawTop = repo.findTopDomains(profileId, startOfDay, top10);
        List<BrowsingStatsResponse.DomainCount> topDomains = rawTop.stream()
                .map(row -> BrowsingStatsResponse.DomainCount.builder()
                        .domain((String) row[0])
                        .count(((Number) row[1]).longValue())
                        .build())
                .toList();

        return BrowsingStatsResponse.builder()
                .totalToday(totalToday)
                .blockedToday(blockedToday)
                .allowedToday(allowedToday)
                .topDomains(topDomains)
                .build();
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * Delete all browsing history for a child profile.
     * Used by the parent to clear history on demand.
     *
     * @param profileId child profile UUID
     */
    @Transactional
    public void deleteHistory(UUID profileId) {
        repo.deleteByProfileId(profileId);
        log.info("Deleted all browsing history for profileId={}", profileId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private BrowsingHistoryResponse toResponse(BrowsingHistory e) {
        return BrowsingHistoryResponse.builder()
                .id(e.getId())
                .profileId(e.getProfileId())
                .tenantId(e.getTenantId())
                .domain(e.getDomain())
                .wasBlocked(e.getWasBlocked())
                .category(e.getCategory())
                .queryType(e.getQueryType())
                .clientIp(e.getClientIp())
                .queriedAt(e.getQueriedAt())
                .build();
    }

    /**
     * Convert a period string to the start {@link OffsetDateTime} (inclusive).
     * Returns null when period is null or unrecognised (meaning "all time").
     */
    private OffsetDateTime periodStart(String period) {
        if (period == null) return null;
        return switch (period.toUpperCase()) {
            case "TODAY" -> todayStart();
            case "WEEK"  -> OffsetDateTime.now().minusDays(7);
            case "MONTH" -> OffsetDateTime.now().minusDays(30);
            default      -> null;
        };
    }

    /** Start of the current calendar day (midnight) in the system timezone. */
    private OffsetDateTime todayStart() {
        return OffsetDateTime.now()
                .toLocalDate()
                .atStartOfDay()
                .atOffset(OffsetDateTime.now().getOffset());
    }
}
