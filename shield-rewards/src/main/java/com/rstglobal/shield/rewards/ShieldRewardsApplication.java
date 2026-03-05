package com.rstglobal.shield.rewards;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.rstglobal.shield")
@EnableJpaAuditing
@EnableScheduling
public class ShieldRewardsApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShieldRewardsApplication.class, args);
    }
}
