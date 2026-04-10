package com.rstglobal.shield.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import java.util.List;

@Configuration
public class GatewayConfig {

    @Value("${shield.app.url:https://shield.rstglobal.in}")
    private String appUrl;

    /**
     * CORS filter — allows requests from the Shield web dashboard and mobile app.
     * In production this must list the exact origin(s).
     */
    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(appUrl));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Correlation-ID"));
        config.setExposedHeaders(List.of("Authorization", "X-Total-Count", "X-Total-Pages", "X-Correlation-ID"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }

    /**
     * Key resolver for Redis rate limiting.
     * Uses X-User-Id header (set by JwtAuthenticationFilter) when present,
     * otherwise falls back to the client IP address.
     */
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            if (userId != null && !userId.isBlank()) {
                return Mono.just("user:" + userId);
            }
            var remoteAddr = exchange.getRequest().getRemoteAddress();
            if (remoteAddr == null) {
                return Mono.just("ip:global");
            }
            return Mono.just("ip:" + remoteAddr.getAddress().getHostAddress());
        };
    }

    /**
     * IP-based key resolver used for strict rate limiting on public auth endpoints
     * (login, register) to prevent brute-force and abuse.
     * Marked @Primary so Spring can auto-wire the single required KeyResolver bean
     * for RequestRateLimiterGatewayFilterFactory.
     *
     * NOTE: Must never throw or return empty — Spring Cloud Gateway fails-open on
     * key resolver errors, silently bypassing rate limiting. Fallback to "global"
     * keeps rate limiting active even when remote address is unavailable.
     */
    @Bean
    @Primary
    public KeyResolver ipKeyResolver() {
        return exchange -> {
            var remoteAddr = exchange.getRequest().getRemoteAddress();
            if (remoteAddr == null) {
                return Mono.just("global"); // all requests share one bucket — still rate-limited
            }
            return Mono.just(remoteAddr.getAddress().getHostAddress());
        };
    }
}
