package com.rstglobal.shield.dns.client;

/**
 * AdGuard Home integration has been removed.
 * Shield uses its own Java-based DNS filtering (shield-dns-resolver) exclusively.
 *
 * This stub is kept only to satisfy any remaining compile references during
 * migration. Once all callers are cleaned up this file can be deleted.
 *
 * @deprecated No-op stub — do not add new usages.
 */
@Deprecated
public class AdGuardClient {

    public void createClient(String clientId, String displayName, String profileId) {}
    public void deleteClient(String clientId) {}
    public void setDnsRewrite(String domain, String answer) {}
    public void removeDnsRewrite(String domain, String answer) {}

    public void updateClient(String clientId, String displayName, AdGuardClientData data) {}

    public java.util.List<java.util.Map<String, Object>> getQueryLog(String clientId, int limit) {
        return java.util.List.of();
    }

    /** @deprecated No-op record kept for compile compatibility only. */
    @Deprecated
    public record AdGuardClientData(
            boolean filteringEnabled,
            boolean safebrowsingEnabled,
            boolean parentalEnabled,
            java.util.Map<String, Object> safeSearch,
            java.util.List<String> blockedServices
    ) {}
}
