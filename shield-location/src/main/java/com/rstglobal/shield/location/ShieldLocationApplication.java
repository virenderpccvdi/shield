package com.rstglobal.shield.location;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.rstglobal.shield")
@EnableAsync
@EnableScheduling
public class ShieldLocationApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShieldLocationApplication.class, args);
    }
}
