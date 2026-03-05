package com.rstglobal.shield.auth.security;

import com.rstglobal.shield.common.security.JwtUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class AuthBeanConfig {

    @Value("${shield.jwt.secret}")
    private String jwtSecret;

    @Value("${shield.jwt.expiry-hours:1}")
    private long expiryHours;

    @Value("${shield.jwt.refresh-days:30}")
    private long refreshDays;

    @Bean
    public JwtUtils jwtUtils() {
        return new JwtUtils(jwtSecret, expiryHours, refreshDays);
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        return template;
    }
}
