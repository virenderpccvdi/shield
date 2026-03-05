package com.rstglobal.shield.common.security;

public final class SecurityConstants {

    private SecurityConstants() {}

    // JWT Claims
    public static final String CLAIM_ROLE       = "role";
    public static final String CLAIM_TENANT_ID  = "tenant_id";
    public static final String CLAIM_EMAIL      = "email";
    public static final String CLAIM_PROFILE_ID = "profile_id";

    // Request Headers (added by Gateway)
    public static final String HEADER_USER_ID    = "X-User-Id";
    public static final String HEADER_USER_ROLE  = "X-User-Role";
    public static final String HEADER_TENANT_ID  = "X-Tenant-Id";
    public static final String HEADER_USER_EMAIL = "X-User-Email";

    // Roles
    public static final String ROLE_GLOBAL_ADMIN = "GLOBAL_ADMIN";
    public static final String ROLE_ISP_ADMIN    = "ISP_ADMIN";
    public static final String ROLE_CUSTOMER     = "CUSTOMER";
    public static final String ROLE_CHILD_APP    = "CHILD_APP";

    // Token types
    public static final String TOKEN_TYPE_ACCESS  = "access";
    public static final String TOKEN_TYPE_REFRESH = "refresh";
    public static final String TOKEN_TYPE_CHILD   = "child";
}
