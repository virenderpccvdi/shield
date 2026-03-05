package com.rstglobal.shield.admin.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Set;

/**
 * Defense-in-depth filter that validates X-User-Role header
 * for admin endpoints. The gateway already performs JWT auth,
 * but this prevents unauthorized access if the gateway is bypassed.
 */
@Component
@Order(1)
@Slf4j
public class AdminRoleFilter implements Filter {

    private static final Set<String> PUBLIC_PREFIXES = Set.of(
            "/api/v1/admin/tr069/webhook",
            "/api/v1/billing/",
            "/actuator/health",
            "/v3/api-docs",
            "/swagger-ui"
    );

    // Billing endpoints allow any authenticated user (not just admins)
    private static final Set<String> ANY_AUTH_PREFIXES = Set.of(
            "/api/v1/admin/billing/",
            "/api/v1/admin/plans"
    );

    private static final Set<String> ADMIN_ROLES = Set.of("GLOBAL_ADMIN", "ISP_ADMIN");

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        String path = req.getRequestURI();

        // Allow public endpoints
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.startsWith(prefix)) {
                chain.doFilter(request, response);
                return;
            }
        }

        // Platform service management requires GLOBAL_ADMIN
        if (path.contains("/platform/services/") && (path.contains("/restart") || path.contains("/stop") || path.contains("/start"))) {
            String role = req.getHeader("X-User-Role");
            if (!"GLOBAL_ADMIN".equals(role)) {
                log.warn("Unauthorized service management attempt: role={}, path={}, ip={}", role, path, req.getRemoteAddr());
                HttpServletResponse res = (HttpServletResponse) response;
                res.setStatus(403);
                res.setContentType("application/json");
                res.getWriter().write("{\"error\":\"FORBIDDEN\",\"message\":\"GLOBAL_ADMIN role required for service management\"}");
                return;
            }
        }

        // Billing endpoints allow any authenticated user (CUSTOMER, ISP_ADMIN, GLOBAL_ADMIN)
        for (String prefix : ANY_AUTH_PREFIXES) {
            if (path.startsWith(prefix)) {
                String role = req.getHeader("X-User-Role");
                if (role != null && !role.isBlank()) {
                    chain.doFilter(request, response);
                    return;
                }
            }
        }

        // All other admin API endpoints require admin role
        if (path.startsWith("/api/v1/admin/")) {
            String role = req.getHeader("X-User-Role");
            if (role == null || !ADMIN_ROLES.contains(role)) {
                log.warn("Unauthorized admin access attempt: role={}, path={}, ip={}", role, path, req.getRemoteAddr());
                HttpServletResponse res = (HttpServletResponse) response;
                res.setStatus(403);
                res.setContentType("application/json");
                res.getWriter().write("{\"error\":\"FORBIDDEN\",\"message\":\"Admin role required\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
