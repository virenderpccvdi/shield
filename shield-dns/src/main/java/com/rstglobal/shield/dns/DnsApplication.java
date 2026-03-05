package com.rstglobal.shield.dns;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.rstglobal.shield")
@EnableJpaAuditing
@EnableScheduling
public class DnsApplication {
    public static void main(String[] args) {
        SpringApplication.run(DnsApplication.class, args);
    }
}
