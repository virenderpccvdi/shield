package com.rstglobal.shield.notification.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * N1: Async executor configuration for notification tasks.
 * The digestExecutor is a dedicated thread pool for weekly digest emails
 * to avoid blocking the default async executor with long SMTP operations.
 */
@Configuration
public class AsyncConfig {

    /**
     * Dedicated executor for weekly digest sending.
     * corePoolSize=4: sustain 4 parallel tenant digest batches.
     * maxPoolSize=8:  burst up to 8 on high load.
     * queueCapacity=100: buffer up to 100 queued tasks before rejection.
     */
    @Bean(name = "digestExecutor")
    public Executor digestExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("digest-");
        executor.initialize();
        return executor;
    }
}
