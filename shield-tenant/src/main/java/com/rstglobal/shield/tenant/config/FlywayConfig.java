package com.rstglobal.shield.tenant.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Spring Boot 4.x removed Flyway autoconfiguration.
 * This class manually configures Flyway for the tenant schema.
 */
@Slf4j
@Configuration
public class FlywayConfig {

    @Bean(name = "flyway")
    public Flyway flyway(DataSource dataSource) {
        log.info("Configuring Flyway for tenant schema...");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas("tenant")
                .table("flyway_schema_history_tenant")
                .locations("classpath:db/migration/tenant")
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
