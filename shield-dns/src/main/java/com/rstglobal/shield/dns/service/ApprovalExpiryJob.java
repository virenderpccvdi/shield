package com.rstglobal.shield.dns.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job that expires temporary domain approvals.
 *
 * Runs every 5 minutes. Finds APPROVED approval requests whose expiresAt has passed,
 * removes the domain from the profile allowlist, and sets status to EXPIRED.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApprovalExpiryJob {

    private final ApprovalRequestService approvalService;

    @Scheduled(fixedDelay = 300_000)
    public void expireApprovals() {
        try {
            approvalService.expireAll();
        } catch (Exception e) {
            log.error("ApprovalExpiryJob failed: {}", e.getMessage(), e);
        }
    }
}
