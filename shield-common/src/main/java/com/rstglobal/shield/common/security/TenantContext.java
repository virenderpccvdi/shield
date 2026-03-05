package com.rstglobal.shield.common.security;

import java.util.UUID;

public final class TenantContext {

    private static final ThreadLocal<UUID> TENANT_ID = new ThreadLocal<>();
    private static final ThreadLocal<UUID> USER_ID   = new ThreadLocal<>();
    private static final ThreadLocal<String> ROLE    = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(UUID tenantId, UUID userId, String role) {
        TENANT_ID.set(tenantId);
        USER_ID.set(userId);
        ROLE.set(role);
    }

    public static UUID getTenantId()  { return TENANT_ID.get(); }
    public static UUID getUserId()    { return USER_ID.get(); }
    public static String getRole()    { return ROLE.get(); }

    public static void clear() {
        TENANT_ID.remove();
        USER_ID.remove();
        ROLE.remove();
    }
}
