package com.rstglobal.shield.analytics.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/**
 * Redis-backed Spring Cache for analytics hot paths.
 *
 * Cache TTLs:
 *   analytics:platform  — 5 min  (platform-wide aggregates)
 *   analytics:tenant    — 5 min  (per-tenant aggregates)
 *   analytics:profile   — 3 min  (per-profile stats)
 *   analytics:daily     — 10 min (time-series breakdowns, changes less often)
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager analyticsCacheManager(RedisConnectionFactory cf) {
        // ObjectMapper with JavaTimeModule + DefaultTyping so Redis stores @class info
        // allowing correct deserialization back to concrete types (not LinkedHashMap)
        ObjectMapper om = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .activateDefaultTyping(
                BasicPolymorphicTypeValidator.builder()
                    .allowIfBaseType(Object.class)
                    .build(),
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
            );

        RedisCacheConfiguration defaultCfg = RedisCacheConfiguration.defaultCacheConfig()
            .prefixCacheNameWith("shield:analytics:")
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(om)))
            .disableCachingNullValues()
            .entryTtl(Duration.ofMinutes(5));

        Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
            "analytics:platform", defaultCfg.entryTtl(Duration.ofMinutes(5)),
            "analytics:tenant",   defaultCfg.entryTtl(Duration.ofMinutes(5)),
            "analytics:profile",  defaultCfg.entryTtl(Duration.ofMinutes(3)),
            "analytics:daily",    defaultCfg.entryTtl(Duration.ofMinutes(10)),
            "analytics:top",      defaultCfg.entryTtl(Duration.ofMinutes(3))
        );

        return RedisCacheManager.builder(cf)
            .cacheDefaults(defaultCfg)
            .withInitialCacheConfigurations(cacheConfigs)
            .build();
    }
}
