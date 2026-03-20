package com.rstglobal.shield.admin.service;

import com.rstglobal.shield.admin.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Handles GDPR / CCPA / LGPD compliance operations:
 *  - Full data export (right of access)
 *  - Right to be forgotten (erasure / anonymisation)
 *  - Audit-trail CSV export
 *
 * Uses JdbcTemplate for cross-schema queries since shield-admin has a direct
 * DB connection and access to all schemas in shield_db.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GdprService {

    private final JdbcTemplate jdbc;
    private final AuditLogRepository auditLogRepository;
    private final AuditLogService auditLogService;

    // ── Right of Access ──────────────────────────────────────────────────────

    /**
     * Collect all data held for a user and return it as a structured map
     * suitable for JSON serialisation and download.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> exportUserData(UUID userId) {
        Map<String, Object> export = new LinkedHashMap<>();
        export.put("exportedAt", OffsetDateTime.now().toString());
        export.put("userId", userId.toString());

        // ── User info (auth schema) ──
        Map<String, Object> userInfo = fetchUserInfo(userId);
        export.put("user_info", userInfo);

        // Derive tenantId from user record for subsequent queries
        UUID tenantId = userInfo.get("tenant_id") != null
                ? UUID.fromString(userInfo.get("tenant_id").toString())
                : null;

        // ── Child profiles (profile schema) ──
        List<Map<String, Object>> profiles = fetchChildProfiles(userId);
        export.put("profiles", profiles);

        // Collect all profileIds for downstream queries
        List<UUID> profileIds = profiles.stream()
                .filter(p -> p.get("id") != null)
                .map(p -> UUID.fromString(p.get("id").toString()))
                .toList();

        // ── DNS activity sample (last 100 queries, last 90 days) ──
        List<Map<String, Object>> dnsActivity = fetchDnsActivity(profileIds);
        export.put("dns_activity_sample", dnsActivity);

        // ── Location history sample (last 100 points, last 90 days) ──
        List<Map<String, Object>> locationHistory = fetchLocationHistory(profileIds);
        export.put("location_history_sample", locationHistory);

        // ── Rewards history ──
        List<Map<String, Object>> rewards = fetchRewards(profileIds);
        export.put("rewards", rewards);

        log.info("GDPR export completed for userId={} profiles={}", userId, profileIds.size());
        return export;
    }

    private Map<String, Object> fetchUserInfo(UUID userId) {
        try {
            return jdbc.queryForMap(
                    "SELECT id, email, name, phone, role, is_active, created_at, tenant_id " +
                    "FROM auth.users WHERE id = ?",
                    userId);
        } catch (Exception e) {
            log.warn("Could not fetch user info for userId={}: {}", userId, e.getMessage());
            return Map.of("id", userId.toString(), "error", "not_found");
        }
    }

    private List<Map<String, Object>> fetchChildProfiles(UUID userId) {
        try {
            return jdbc.queryForList(
                    "SELECT id, name, age, filter_level, screen_time_limit_minutes, is_active, created_at " +
                    "FROM profile.child_profiles WHERE customer_user_id = ? ORDER BY created_at",
                    userId);
        } catch (Exception e) {
            log.warn("Could not fetch child profiles for userId={}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> fetchDnsActivity(List<UUID> profileIds) {
        if (profileIds.isEmpty()) return List.of();
        try {
            OffsetDateTime since = OffsetDateTime.now().minusDays(90);
            // Build IN clause safely with positional params
            String placeholders = String.join(",", Collections.nCopies(profileIds.size(), "?"));
            List<Object> params = new ArrayList<>();
            params.add(since);
            params.addAll(profileIds.stream().map(UUID::toString).toList());

            return jdbc.queryForList(
                    "SELECT profile_id, domain, action, category, queried_at " +
                    "FROM dns.query_logs " +
                    "WHERE queried_at >= ? AND profile_id::text IN (" + placeholders + ") " +
                    "ORDER BY queried_at DESC LIMIT 100",
                    params.toArray());
        } catch (Exception e) {
            log.warn("Could not fetch DNS activity: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> fetchLocationHistory(List<UUID> profileIds) {
        if (profileIds.isEmpty()) return List.of();
        try {
            OffsetDateTime since = OffsetDateTime.now().minusDays(90);
            String placeholders = String.join(",", Collections.nCopies(profileIds.size(), "?"));
            List<Object> params = new ArrayList<>();
            params.add(since);
            params.addAll(profileIds.stream().map(UUID::toString).toList());

            return jdbc.queryForList(
                    "SELECT profile_id, latitude, longitude, accuracy, speed, battery_pct, recorded_at " +
                    "FROM location.location_points " +
                    "WHERE recorded_at >= ? AND profile_id::text IN (" + placeholders + ") " +
                    "ORDER BY recorded_at DESC LIMIT 100",
                    params.toArray());
        } catch (Exception e) {
            log.warn("Could not fetch location history: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> fetchRewards(List<UUID> profileIds) {
        if (profileIds.isEmpty()) return List.of();
        try {
            String placeholders = String.join(",", Collections.nCopies(profileIds.size(), "?"));
            Object[] params = profileIds.stream().map(UUID::toString).toArray();
            return jdbc.queryForList(
                    "SELECT profile_id, points_earned, points_redeemed, reason, created_at " +
                    "FROM rewards.reward_transactions " +
                    "WHERE profile_id::text IN (" + placeholders + ") " +
                    "ORDER BY created_at DESC",
                    params);
        } catch (Exception e) {
            log.warn("Could not fetch rewards: {}", e.getMessage());
            return List.of();
        }
    }

    // ── Right to Erasure ─────────────────────────────────────────────────────

    /**
     * Anonymise all personal data for a user and hard-delete GPS location points.
     * Soft-deletes child profiles, anonymises the auth user record.
     */
    @Transactional
    public Map<String, Object> forgetUser(UUID userId, UUID adminId, String adminEmail, String ipAddress) {
        log.warn("GDPR forget request for userId={} by admin={}", userId, adminEmail);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId.toString());
        result.put("processedAt", OffsetDateTime.now().toString());

        // 1. Anonymise auth user
        int usersUpdated = anonymiseAuthUser(userId);
        result.put("authUserAnonymised", usersUpdated > 0);

        // 2. Soft-delete child profiles
        int profilesDeactivated = deactivateChildProfiles(userId);
        result.put("profilesDeactivated", profilesDeactivated);

        // Collect profile IDs for downstream cleanup
        List<UUID> profileIds = collectProfileIds(userId);
        result.put("profileCount", profileIds.size());

        // 3. Hard-delete GPS location points
        int locationPointsDeleted = deleteLocationPoints(profileIds);
        result.put("locationPointsDeleted", locationPointsDeleted);

        // 4. Anonymise DNS log profile references (set profile_id = NULL)
        int dnsLogsAnonymised = anonymiseDnsLogs(profileIds);
        result.put("dnsLogsAnonymised", dnsLogsAnonymised);

        // 5. Record in audit log
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("action", "GDPR_FORGET");
        details.put("targetUserId", userId.toString());
        details.put("profilesDeactivated", profilesDeactivated);
        details.put("locationPointsDeleted", locationPointsDeleted);
        details.put("dnsLogsAnonymised", dnsLogsAnonymised);
        auditLogService.log("GDPR_FORGET", "USER", userId.toString(),
                adminId, adminEmail, ipAddress, details);

        result.put("status", "COMPLETED");
        log.warn("GDPR forget completed for userId={}: profiles={} gps={} dns={}",
                userId, profilesDeactivated, locationPointsDeleted, dnsLogsAnonymised);
        return result;
    }

    private int anonymiseAuthUser(UUID userId) {
        try {
            return jdbc.update(
                    "UPDATE auth.users SET name = 'Deleted User', " +
                    "email = 'deleted_' || id || '@shield.deleted', " +
                    "phone = NULL, is_active = FALSE " +
                    "WHERE id = ?",
                    userId);
        } catch (Exception e) {
            log.error("Failed to anonymise auth user {}: {}", userId, e.getMessage());
            return 0;
        }
    }

    private int deactivateChildProfiles(UUID userId) {
        try {
            return jdbc.update(
                    "UPDATE profile.child_profiles SET is_active = FALSE " +
                    "WHERE customer_user_id = ?",
                    userId);
        } catch (Exception e) {
            log.error("Failed to deactivate profiles for userId={}: {}", userId, e.getMessage());
            return 0;
        }
    }

    private List<UUID> collectProfileIds(UUID userId) {
        try {
            return jdbc.queryForList(
                    "SELECT id FROM profile.child_profiles WHERE customer_user_id = ?",
                    UUID.class, userId);
        } catch (Exception e) {
            log.warn("Could not collect profile IDs for userId={}: {}", userId, e.getMessage());
            return List.of();
        }
    }

    private int deleteLocationPoints(List<UUID> profileIds) {
        if (profileIds.isEmpty()) return 0;
        try {
            String placeholders = String.join(",", Collections.nCopies(profileIds.size(), "?"));
            Object[] params = profileIds.stream().map(UUID::toString).toArray();
            return jdbc.update(
                    "DELETE FROM location.location_points WHERE profile_id::text IN (" + placeholders + ")",
                    params);
        } catch (Exception e) {
            log.error("Failed to delete location points: {}", e.getMessage());
            return 0;
        }
    }

    private int anonymiseDnsLogs(List<UUID> profileIds) {
        if (profileIds.isEmpty()) return 0;
        try {
            String placeholders = String.join(",", Collections.nCopies(profileIds.size(), "?"));
            Object[] params = profileIds.stream().map(UUID::toString).toArray();
            return jdbc.update(
                    "UPDATE dns.query_logs SET profile_id = NULL " +
                    "WHERE profile_id::text IN (" + placeholders + ")",
                    params);
        } catch (Exception e) {
            log.warn("Could not anonymise DNS logs (table may not exist): {}", e.getMessage());
            return 0;
        }
    }

    // ── Audit Trail CSV Export ───────────────────────────────────────────────

    /**
     * Export the audit_logs table as a UTF-8 CSV byte array.
     * Columns: timestamp, admin_email, action, entity_type, entity_id, details, ip_address
     */
    @Transactional(readOnly = true)
    public byte[] exportAuditTrailCsv(OffsetDateTime from, OffsetDateTime to, Pageable pageable) {
        Specification<com.rstglobal.shield.admin.entity.AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<com.rstglobal.shield.admin.entity.AuditLog> page =
                auditLogRepository.findAll(spec, pageable);

        StringBuilder csv = new StringBuilder();
        // Header
        csv.append("timestamp,admin_email,action,entity_type,entity_id,details,ip_address\n");

        for (var log : page.getContent()) {
            csv.append(csvEscape(log.getCreatedAt() != null ? log.getCreatedAt().toString() : "")).append(",");
            csv.append(csvEscape(log.getUserName())).append(",");
            csv.append(csvEscape(log.getAction())).append(",");
            csv.append(csvEscape(log.getResourceType())).append(",");
            csv.append(csvEscape(log.getResourceId())).append(",");
            // Serialise details map as simple k=v pairs in the CSV cell
            String details = log.getDetails() != null
                    ? log.getDetails().entrySet().stream()
                        .map(e -> e.getKey() + "=" + e.getValue())
                        .reduce((a, b) -> a + "; " + b)
                        .orElse("")
                    : "";
            csv.append(csvEscape(details)).append(",");
            csv.append(csvEscape(log.getIpAddress())).append("\n");
        }

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    /** Wrap a value in double-quotes and escape internal quotes. Returns empty string for null. */
    private String csvEscape(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
