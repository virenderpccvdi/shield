package com.rstglobal.shield.common.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Slf4j
public class JwtUtils {

    private final SecretKey secretKey;
    private final long accessExpirySeconds;
    private final long refreshExpirySeconds;

    public JwtUtils(String secret, long accessExpiryHours, long refreshExpiryDays) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirySeconds = accessExpiryHours * 3600L;
        this.refreshExpirySeconds = refreshExpiryDays * 86400L;
    }

    public String generateAccessToken(UUID userId, String email, String role, UUID tenantId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim(SecurityConstants.CLAIM_EMAIL, email)
                .claim(SecurityConstants.CLAIM_ROLE, role)
                .claim(SecurityConstants.CLAIM_TENANT_ID, tenantId != null ? tenantId.toString() : null)
                .claim("type", SecurityConstants.TOKEN_TYPE_ACCESS)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessExpirySeconds)))
                .signWith(secretKey, Jwts.SIG.HS512)
                .compact();
    }

    public String generateChildToken(UUID profileId, UUID customerId, UUID tenantId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(profileId.toString())
                .claim(SecurityConstants.CLAIM_ROLE, SecurityConstants.ROLE_CHILD_APP)
                .claim(SecurityConstants.CLAIM_TENANT_ID, tenantId.toString())
                .claim(SecurityConstants.CLAIM_PROFILE_ID, profileId.toString())
                .claim("customer_id", customerId.toString())
                .claim("type", SecurityConstants.TOKEN_TYPE_CHILD)
                .issuedAt(Date.from(now))
                // Child tokens expire in 365 days
                .expiration(Date.from(now.plusSeconds(365 * 86400L)))
                .signWith(secretKey, Jwts.SIG.HS512)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }

    public String getRole(String token) {
        return parseToken(token).get(SecurityConstants.CLAIM_ROLE, String.class);
    }

    public UUID getUserId(String token) {
        return UUID.fromString(parseToken(token).getSubject());
    }

    public UUID getTenantId(String token) {
        String tid = parseToken(token).get(SecurityConstants.CLAIM_TENANT_ID, String.class);
        return tid != null ? UUID.fromString(tid) : null;
    }
}
