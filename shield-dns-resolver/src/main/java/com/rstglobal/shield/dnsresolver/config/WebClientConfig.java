package com.rstglobal.shield.dnsresolver.config;

import org.springframework.context.annotation.Configuration;

/**
 * WebClient configuration removed — upstream DNS resolution now uses
 * dnsjava SimpleResolver (UDP) instead of HTTP/DoH.
 */
@Configuration
public class WebClientConfig {
    // No beans required. Upstream DNS uses dnsjava SimpleResolver (UDP).
}
