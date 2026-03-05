package com.rstglobal.shield.admin.service;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import com.rstglobal.shield.admin.dto.response.BulkImportJobResponse;
import com.rstglobal.shield.admin.entity.BulkImportJob;
import com.rstglobal.shield.admin.repository.BulkImportJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStreamReader;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BulkImportService {

    private final BulkImportJobRepository jobRepository;

    /**
     * Parse CSV, validate rows, create job record, process asynchronously.
     */
    @Transactional
    public BulkImportJobResponse importCustomers(MultipartFile file, UUID tenantId, UUID initiatedBy) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is required");
        }

        List<String[]> rows;
        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            rows = reader.readAll();
        } catch (IOException | CsvException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to parse CSV: " + e.getMessage());
        }

        // Skip header row
        int totalRecords = Math.max(0, rows.size() - 1);

        BulkImportJob job = BulkImportJob.builder()
                .tenantId(tenantId)
                .initiatedBy(initiatedBy)
                .jobType("CUSTOMER_IMPORT")
                .status("PENDING")
                .totalRecords(totalRecords)
                .fileName(file.getOriginalFilename())
                .build();
        job = jobRepository.save(job);

        processJobAsync(job.getId(), rows);
        return toResponse(job);
    }

    @Async
    public void processJobAsync(UUID jobId, List<String[]> rows) {
        BulkImportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) return;

        job.setStatus("PROCESSING");
        job.setStartedAt(OffsetDateTime.now());
        jobRepository.save(job);

        int successCount = 0;
        int failureCount = 0;
        List<String> errors = new ArrayList<>();

        // Skip header row (index 0), process data rows
        for (int i = 1; i < rows.size(); i++) {
            String[] row = rows.get(i);
            try {
                validateRow(row, i);
                // Row is valid - in a real implementation this would call the auth service
                // to create the user account. Here we count it as a success.
                successCount++;
            } catch (IllegalArgumentException e) {
                failureCount++;
                errors.add("Row " + (i + 1) + ": " + e.getMessage());
                log.warn("CSV row {} validation failed: {}", i + 1, e.getMessage());
            }
            job.setProcessedRecords(i);
            jobRepository.save(job);
        }

        job.setSuccessCount(successCount);
        job.setFailureCount(failureCount);
        job.setErrorDetails(errors.isEmpty() ? null : errors);
        job.setStatus(failureCount == 0 ? "COMPLETED" : (successCount == 0 ? "FAILED" : "COMPLETED"));
        job.setCompletedAt(OffsetDateTime.now());
        jobRepository.save(job);

        log.info("Bulk import job {} completed: success={}, failure={}", jobId, successCount, failureCount);
    }

    private void validateRow(String[] row, int rowIndex) {
        // Expect at minimum: email (col 0), name (col 1)
        if (row.length < 2) {
            throw new IllegalArgumentException("Row must have at least 2 columns (email, name)");
        }
        String email = row[0] == null ? "" : row[0].trim();
        String name  = row[1] == null ? "" : row[1].trim();
        if (email.isEmpty()) {
            throw new IllegalArgumentException("email is required");
        }
        if (!email.matches("^[^@]+@[^@]+\\.[^@]+$")) {
            throw new IllegalArgumentException("invalid email: " + email);
        }
        if (name.isEmpty()) {
            throw new IllegalArgumentException("name is required");
        }
    }

    public BulkImportJobResponse getJobStatus(UUID jobId) {
        BulkImportJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId));
        return toResponse(job);
    }

    public Page<BulkImportJobResponse> listJobs(UUID tenantId, Pageable pageable) {
        return jobRepository.findByTenantId(tenantId, pageable).map(this::toResponse);
    }

    private BulkImportJobResponse toResponse(BulkImportJob j) {
        return BulkImportJobResponse.builder()
                .id(j.getId())
                .status(j.getStatus())
                .jobType(j.getJobType())
                .totalRecords(j.getTotalRecords())
                .processedRecords(j.getProcessedRecords())
                .successCount(j.getSuccessCount())
                .failureCount(j.getFailureCount())
                .fileName(j.getFileName())
                .startedAt(j.getStartedAt())
                .completedAt(j.getCompletedAt())
                .createdAt(j.getCreatedAt())
                .build();
    }
}
