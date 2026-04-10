package com.rstglobal.shield.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.rstglobal.shield")
@EnableDiscoveryClient
@EnableScheduling
public class ShieldAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShieldAdminApplication.class, args);
    }
}
