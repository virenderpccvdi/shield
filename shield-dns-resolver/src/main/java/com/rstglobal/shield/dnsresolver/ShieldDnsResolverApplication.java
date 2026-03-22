package com.rstglobal.shield.dnsresolver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@EnableAsync
public class ShieldDnsResolverApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShieldDnsResolverApplication.class, args);
    }
}
