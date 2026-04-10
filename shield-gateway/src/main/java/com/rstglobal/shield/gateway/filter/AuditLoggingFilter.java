package com.rstglobal.shield.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Set;

/**
 * Global audit logging filter.
 *
 * Logs: correlationId, method, path, userId, tenantId, status, durationMs.
 * Uses MDC for structured logging.
 * Skips /actuator and /docs paths.
 *
 * Runs at order -99 (just after JwtAuthenticationFilter at -100, so headers are already injected).
 */
@Slf4j
@Component
public class AuditLoggingFilter implements GlobalFilter, Ordered {

    private static final Set<String> SKIP_PREFIXES = Set.of("/actuator", "/docs");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Skip health/docs paths — no audit noise
        if (SKIP_PREFIXES.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        String method        = request.getMethod().name();
        String correlationId = request.getHeaders().getFirst("X-Correlation-ID");
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = java.util.UUID.randomUUID().toString();
        }
        // These headers are injected by JwtAuthenticationFilter (or empty for public paths)
        String userId   = request.getHeaders().getFirst("X-User-Id");
        String tenantId = request.getHeaders().getFirst("X-Tenant-Id");

        final String finalCorrelationId = correlationId;
        final long   startMs            = System.currentTimeMillis();

        // Set MDC for this reactive context — reactor-aware via contextCapture
        MDC.put("correlationId", finalCorrelationId);
        MDC.put("method",        method);
        MDC.put("path",          path);
        if (userId   != null && !userId.isBlank())   MDC.put("userId",   userId);
        if (tenantId != null && !tenantId.isBlank()) MDC.put("tenantId", tenantId);

        log.debug("REQ  {} {} userId={} tenant={} cid={}", method, path, userId, tenantId, finalCorrelationId);

        // Add correlation id to the downstream request so services can use it
        ServerWebExchange mutated = exchange.mutate()
                .request(request.mutate()
                        .header("X-Correlation-ID", finalCorrelationId)
                        .build())
                .build();

        return chain.filter(mutated)
                .doFinally(signal -> {
                    ServerHttpResponse response = mutated.getResponse();
                    int statusCode = response.getStatusCode() != null
                            ? response.getStatusCode().value() : 0;
                    long durationMs = System.currentTimeMillis() - startMs;

                    MDC.put("status",     String.valueOf(statusCode));
                    MDC.put("durationMs", String.valueOf(durationMs));

                    log.info("RES  {} {} {} {}ms cid={}", method, path, statusCode, durationMs, finalCorrelationId);

                    MDC.remove("correlationId");
                    MDC.remove("method");
                    MDC.remove("path");
                    MDC.remove("userId");
                    MDC.remove("tenantId");
                    MDC.remove("status");
                    MDC.remove("durationMs");
                });
    }

    @Override
    public int getOrder() {
        return -99;
    }
}
