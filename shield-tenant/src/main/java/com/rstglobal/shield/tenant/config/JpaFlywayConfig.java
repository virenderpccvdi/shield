package com.rstglobal.shield.tenant.config;

import org.springframework.boot.jpa.autoconfigure.EntityManagerFactoryDependsOnPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ensures the JPA EntityManagerFactory bean is initialized AFTER
 * the "flyway" bean has run all migrations.
 */
@Configuration
public class JpaFlywayConfig {

    @Bean
    public static EntityManagerFactoryDependsOnPostProcessor flywayEntityManagerFactoryDependsOnPostProcessor() {
        return new EntityManagerFactoryDependsOnPostProcessor("flyway");
    }
}
