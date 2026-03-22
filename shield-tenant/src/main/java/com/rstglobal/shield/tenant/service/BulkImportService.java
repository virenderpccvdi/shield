package com.rstglobal.shield.tenant.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.tenant.entity.BulkImportJob;
import com.rstglobal.shield.tenant.repository.BulkImportJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * IS-03 — Bulk Customer Import
 *
 * Accepts a CSV stream (email, name, phone, planId), registers each row as
 * a CUSTOMER via the auth internal endpoint, and tracks progress in
 * tenant.bulk_import_jobs.
 *
 * Idempotent: duplicate emails return 409 from auth and are silently skipped
 * (not counted as failures).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkImportService {

    private final BulkImportJobRepository jobRepo;
    private final RestClient restClient = RestClient.builder().build();

    @Value("${shield.auth.url:http://localhost:8281}")
    private String authBaseUrl;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Parse the CSV, save the job as PENDING, kick off async processing,
     * and return the jobId immediately.
     */
    public UUID startImport(UUID tenantId, String filename, InputStream inputStream) {
        List<String[]> rows = parseCsv(inputStream);

        BulkImportJob job = BulkImportJob.builder()
                .tenantId(tenantId)
                .filename(filename)
                .totalRows(rows.size())
                .status("PENDING")
                .build();
        job = jobRepo.save(job);
        log.info("BulkImport job {} created: {} rows for tenant {}", job.getId(), rows.size(), tenantId);

        // Process asynchronously — returns immediately to the caller
        processAsync(job.getId(), tenantId, rows);

        return job.getId();
    }

    /**
     * Retrieve the current status of a job.
     */
    public BulkImportJob getStatus(UUID jobId, UUID tenantId) {
        return jobRepo.findByIdAndTenantId(jobId, tenantId)
                .orElseThrow(() -> ShieldException.notFound("BulkImportJob", jobId));
    }

    // ── Async processing ──────────────────────────────────────────────────────

    @Async
    public void processAsync(UUID jobId, UUID tenantId, List<String[]> rows) {
        BulkImportJob job = jobRepo.findById(jobId)
                .orElseThrow(() -> new IllegalStateException("BulkImportJob not found: " + jobId));

        job.setStatus("PROCESSING");
        job.setUpdatedAt(Instant.now());
        jobRepo.save(job);

        int successRows = 0;
        int failedRows = 0;
        List<String> errorDetails = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            String[] row = rows.get(i);
            int rowNum = i + 2; // 1-based, +1 for header

            // Extract fields (allow partial rows)
            String email = row.length > 0 ? row[0].trim() : "";
            String name  = row.length > 1 ? row[1].trim() : "";
            String phone = row.length > 2 ? row[2].trim() : "";

            // Basic email validation
            if (email.isBlank() || !email.contains("@")) {
                failedRows++;
                errorDetails.add("Row " + rowNum + ": invalid or missing email '" + email + "'");
                continue;
            }

            // Fall back to email-prefix if no name supplied
            if (name.isBlank()) {
                name = email.split("@")[0];
            }

            try {
                callAuthCreateCustomer(email, name, phone, tenantId);
                successRows++;
                log.debug("BulkImport job {}: created user {}", jobId, email);
            } catch (HttpClientErrorException.Conflict ex) {
                // 409 — email already exists, skip silently (idempotent)
                log.debug("BulkImport job {}: skipping duplicate email {}", jobId, email);
                successRows++;  // count as success — account exists, outcome is the same
            } catch (Exception ex) {
                failedRows++;
                String msg = "Row " + rowNum + " (" + email + "): " + ex.getMessage();
                errorDetails.add(msg);
                log.warn("BulkImport job {}: failed row {}: {}", jobId, rowNum, ex.getMessage());
            }
        }

        // Finalise
        job.setSuccessRows(successRows);
        job.setFailedRows(failedRows);
        job.setErrorDetails(errorDetails.isEmpty() ? null : errorDetails);
        job.setStatus("DONE");
        job.setCompletedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        jobRepo.save(job);

        log.info("BulkImport job {} DONE: success={}, failed={}", jobId, successRows, failedRows);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Parse CSV (with or without header row email,name,phone,planId).
     * Skips completely blank lines.
     */
    private List<String[]> parseCsv(InputStream inputStream) {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(inputStream, StandardCharsets.UTF_8));
             CSVParser parser = CSVFormat.DEFAULT
                     .builder()
                     .setIgnoreEmptyLines(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            boolean firstRow = true;
            for (CSVRecord record : parser) {
                // Skip header row if first cell looks like a column name
                if (firstRow) {
                    firstRow = false;
                    String firstCell = record.size() > 0 ? record.get(0).toLowerCase() : "";
                    if ("email".equals(firstCell)) {
                        continue; // skip header
                    }
                }
                String[] row = new String[record.size()];
                for (int i = 0; i < record.size(); i++) {
                    row[i] = record.get(i);
                }
                rows.add(row);
            }
        } catch (Exception e) {
            throw ShieldException.badRequest("Failed to parse CSV: " + e.getMessage());
        }
        return rows;
    }

    /**
     * POST to auth service internal endpoint to create a CUSTOMER account.
     * Throws HttpClientErrorException.Conflict (409) if email already exists.
     */
    private void callAuthCreateCustomer(String email, String name, String phone, UUID tenantId) {
        Map<String, Object> body = new HashMap<>();
        body.put("email",    email);
        body.put("name",     name);
        body.put("phone",    phone.isBlank() ? null : phone);
        body.put("tenantId", tenantId.toString());
        body.put("role",     "CUSTOMER");

        restClient.post()
                .uri(authBaseUrl + "/internal/users/create-customer")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }
}
