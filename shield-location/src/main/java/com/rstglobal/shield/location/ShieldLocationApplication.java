package com.rstglobal.shield.location;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(scanBasePackages = "com.rstglobal.shield")
@EnableAsync
public class ShieldLocationApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShieldLocationApplication.class, args);
    }
}
