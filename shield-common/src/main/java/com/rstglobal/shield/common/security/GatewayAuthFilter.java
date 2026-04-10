package com.rstglobal.shield.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads the X-User-Id / X-User-Role headers injected by the API Gateway and
 * populates the Spring Security context so that {@code anyRequest().authenticated()}
 * works correctly for downstream services.
 *
 * <p>This filter MUST be registered in each service's {@code SecurityFilterChain}
 * <em>before</em> the Spring Security anonymous filter:
 * <pre>{@code
 *   .addFilterBefore(new GatewayAuthFilter(), AnonymousAuthenticationFilter.class)
 * }</pre>
 *
 * <p>Services are internal-only and run behind the API Gateway, which already
 * validates JWT tokens. Re-validating JWTs here would duplicate work and introduce
 * coupling (shared secret propagation). Instead, we trust the injected headers
 * which are only set by the gateway's {@code JwtAuthenticationFilter}.
 */
public class GatewayAuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String userId = request.getHeader(SecurityConstants.HEADER_USER_ID);
        String role   = request.getHeader(SecurityConstants.HEADER_USER_ROLE);

        if (userId != null && !userId.isBlank() && role != null && !role.isBlank()) {
            var authority = new SimpleGrantedAuthority("ROLE_" + role);
            var auth = UsernamePasswordAuthenticationToken.authenticated(
                    userId, null, List.of(authority));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}
