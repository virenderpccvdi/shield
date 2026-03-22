package com.rstglobal.shield.dns.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * PC-02 — Homework Mode expiry job.
 * Runs every 60 seconds and deactivates any homework sessions whose end time has passed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HomeworkModeExpiryJob {

    private final HomeworkModeService homeworkModeService;

    /**
     * Checks for expired homework sessions and deactivates them.
     * fixedDelay ensures the next run starts 60 s after the previous one completes,
     * preventing overlapping expiry runs.
     */
    @Scheduled(fixedDelay = 60_000)
    public void expireHomeworkSessions() {
        try {
            homeworkModeService.expireAll();
        } catch (Exception e) {
            log.error("Error during homework mode expiry sweep", e);
        }
    }
}
