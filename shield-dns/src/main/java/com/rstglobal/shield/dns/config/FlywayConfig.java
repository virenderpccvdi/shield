package com.rstglobal.shield.dns.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Slf4j
@Configuration
public class FlywayConfig {

    @Bean(name = "flyway")
    public Flyway flyway(DataSource dataSource) {
        log.info("Configuring Flyway for dns schema...");
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas("dns")
                .table("flyway_schema_history_dns")
                .locations("classpath:db/migration/dns")
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
