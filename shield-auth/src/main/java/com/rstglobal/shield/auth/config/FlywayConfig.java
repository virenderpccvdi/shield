package com.rstglobal.shield.auth.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Spring Boot 4.x removed Flyway autoconfiguration from spring-boot-autoconfigure.
 * This class manually configures and runs Flyway BEFORE JPA schema validation.
 * Uses InitializingBean ordering via @DependsOn("dataSource").
 */
@Slf4j
@Configuration
public class FlywayConfig {

    /**
     * Creates a Flyway instance and runs pending migrations.
     * Named "flyway" so that the JPA EntityManagerFactory (via
     * EntityManagerFactoryDependsOnPostProcessor) can declare @DependsOn("flyway").
     */
    @Bean(name = "flyway")
    public Flyway flyway(DataSource dataSource) {
        log.info("Configuring Flyway for auth schema...");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas("auth")
                .table("flyway_schema_history_auth")
                .locations("classpath:db/migration/auth")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .outOfOrder(false)
                .load();

        flyway.repair();
        var result = flyway.migrate();
        log.info("Flyway migration complete: {} migrations applied", result.migrationsExecuted);
        return flyway;
    }
}
