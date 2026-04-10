package com.rstglobal.shield.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Global filter that:
 * 1. Validates JWT Bearer tokens (signature + expiry)
 * 2. Checks Redis blacklist — rejects tokens issued before a logout event
 * 3. Injects X-User-Id, X-User-Role, X-Tenant-Id headers for downstream services
 *
 * Runs at order -100 (before all route filters).
 */
@Slf4j
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final String BEARER_PREFIX    = "Bearer ";
    private static final String BLACKLIST_PREFIX = "shield:auth:blacklist:";

    private static final Set<String> PUBLIC_PREFIXES = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/api/v1/auth/verify-email",

            "/api/v1/auth/mfa/validate",
            "/api/v1/billing/",
            "/api/v1/admin/contact/submit",
            "/api/v1/admin/visitors/track",
            "/api/v1/admin/plans/public",
            "/actuator/health",
            "/actuator/info",
            "/api/v1/ai/actuator/health",
            "/docs/",
            "/public/"
    );

    @Value("${shield.jwt.secret}")
    private String jwtSecret;

    private SecretKey secretKey;

    /** Reactive Redis — already configured for rate limiting; reuse here for blacklist check */
    private final ReactiveStringRedisTemplate redis;

    public JwtAuthenticationFilter(ReactiveStringRedisTemplate redis) {
        this.redis = redis;
    }

    @PostConstruct
    public void init() {
        this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (isPublic(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return unauthorized(exchange, "Authorization header missing or invalid");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());
        Claims claims;
        try {
            claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return unauthorized(exchange, "Token expired or invalid");
        } catch (Exception e) {
            log.warn("Unexpected error during JWT validation", e);
            return unauthorized(exchange, "Authentication error");
        }

        String userId   = claims.getSubject();
        String role     = claims.get("role",     String.class);
        // JWT uses snake_case "tenant_id"; fall back to camelCase "tenantId" for compat
        String tenantId = claims.get("tenant_id", String.class);
        if (tenantId == null) tenantId = claims.get("tenantId", String.class);
        long   tokenIat = claims.getIssuedAt() != null
                          ? claims.getIssuedAt().toInstant().getEpochSecond() : 0;

        // Reject tokens missing required claims — prevents null header injection to downstream services
        if (userId == null || userId.isBlank()) {
            log.debug("JWT missing subject (userId) claim — rejecting");
            return unauthorized(exchange, "Token missing required claims");
        }
        if (role == null || role.isBlank()) {
            log.debug("JWT missing role claim for userId={} — rejecting", userId);
            return unauthorized(exchange, "Token missing required claims");
        }

        // Child app tokens carry CHILD_APP role — downstream services expect CUSTOMER.
        // Map it here so no service needs to know about the CHILD_APP role.
        // X-Profile-Id is also injected so child-specific services can identify the profile.
        String profileId = claims.get("profile_id", String.class);
        String effectiveRole = "CHILD_APP".equals(role) ? "CUSTOMER" : role;

        // Build the mutated request with validated, non-null claim values
        ServerHttpRequest mutated = exchange.getRequest().mutate()
                .header("X-User-Id",    userId)
                .header("X-User-Role",  effectiveRole)
                .header("X-Tenant-Id",  tenantId    != null ? tenantId    : "")
                .header("X-Profile-Id", profileId   != null ? profileId   : "")
                .headers(h -> h.remove(HttpHeaders.AUTHORIZATION))
                .build();

        ServerWebExchange mutatedExchange = exchange.mutate().request(mutated).build();

        // Check Redis blacklist: key = shield:auth:blacklist:{userId}, value = epoch second of logout
        return redis.opsForValue().get(BLACKLIST_PREFIX + userId)
                .flatMap(blacklistTs -> {
                    try {
                        long logoutEpoch = Long.parseLong(blacklistTs);
                        if (tokenIat <= logoutEpoch) {
                            log.debug("Blacklisted token rejected for userId={}", userId);
                            return unauthorized(exchange, "Token has been revoked. Please sign in again.");
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Malformed blacklist entry for userId={}: {}", userId, blacklistTs);
                    }
                    return chain.filter(mutatedExchange);
                })
                // No blacklist entry → token is valid
                .switchIfEmpty(chain.filter(mutatedExchange));
    }

    private boolean isPublic(String path) {
        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = String.format(
                "{\"success\":false,\"error\":\"UNAUTHORIZED\",\"message\":\"%s\"}", message);
        DataBuffer buffer = exchange.getResponse().bufferFactory()
                .wrap(body.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
