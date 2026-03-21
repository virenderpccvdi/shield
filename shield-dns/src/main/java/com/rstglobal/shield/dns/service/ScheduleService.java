package com.rstglobal.shield.dns.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.dns.dto.request.ScheduleOverrideRequest;
import com.rstglobal.shield.dns.dto.request.UpdateScheduleRequest;
import com.rstglobal.shield.dns.dto.response.ScheduleResponse;
import com.rstglobal.shield.dns.entity.Schedule;
import com.rstglobal.shield.dns.repository.ScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepo;

    @Transactional
    public Schedule initSchedule(UUID tenantId, UUID profileId) {
        if (scheduleRepo.existsByProfileId(profileId)) {
            return scheduleRepo.findByProfileId(profileId).get();
        }
        Schedule s = Schedule.builder()
                .tenantId(tenantId)
                .profileId(profileId)
                .grid(defaultGrid())
                .build();
        return scheduleRepo.save(s);
    }

    @Transactional
    public ScheduleResponse getSchedule(UUID profileId) {
        // Auto-create default schedule if none exists — prevents "Schedule not found" errors
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).grid(defaultGrid()).build()));
        return toResponse(s);
    }

    @Transactional
    public ScheduleResponse updateSchedule(UUID profileId, UpdateScheduleRequest req) {
        // Auto-create if not found (same resilience as getSchedule)
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).grid(defaultGrid()).build()));
        s.setGrid(req.getGrid());
        s.setActivePreset(req.getActivePreset());
        return toResponse(scheduleRepo.save(s));
    }

    @Transactional
    public ScheduleResponse applyPreset(UUID profileId, String preset) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).grid(defaultGrid()).build()));
        s.setGrid(gridForPreset(preset));
        s.setActivePreset(preset);
        return toResponse(scheduleRepo.save(s));
    }

    @Transactional
    public ScheduleResponse applyOverride(UUID profileId, ScheduleOverrideRequest req) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).grid(defaultGrid()).build()));
        s.setOverrideActive(true);
        s.setOverrideType(req.getOverrideType());
        s.setOverrideEndsAt(req.getDurationMinutes() > 0
                ? OffsetDateTime.now().plusMinutes(req.getDurationMinutes())
                : null);
        return toResponse(scheduleRepo.save(s));
    }

    @Transactional
    public ScheduleResponse cancelOverride(UUID profileId) {
        Schedule s = scheduleRepo.findByProfileId(profileId)
                .orElseGet(() -> scheduleRepo.save(
                        Schedule.builder().profileId(profileId).grid(defaultGrid()).build()));
        s.setOverrideActive(false);
        s.setOverrideType(null);
        s.setOverrideEndsAt(null);
        return toResponse(scheduleRepo.save(s));
    }

    /** Scheduled: expire overrides every minute. */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireOverrides() {
        OffsetDateTime now = OffsetDateTime.now();
        scheduleRepo.findAll().stream()
                .filter(s -> Boolean.TRUE.equals(s.getOverrideActive())
                        && s.getOverrideEndsAt() != null
                        && s.getOverrideEndsAt().isBefore(now))
                .forEach(s -> {
                    s.setOverrideActive(false);
                    s.setOverrideType(null);
                    s.setOverrideEndsAt(null);
                    scheduleRepo.save(s);
                    log.info("Override expired for profileId={}", s.getProfileId());
                });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Schedule findOrThrow(UUID profileId) {
        return scheduleRepo.findByProfileId(profileId)
                .orElseThrow(() -> ShieldException.notFound("schedule", profileId.toString()));
    }

    /** Default: all hours allowed (all zeros). */
    private Map<String, List<Integer>> defaultGrid() {
        List<String> days = List.of("monday","tuesday","wednesday","thursday","friday","saturday","sunday");
        Map<String, List<Integer>> grid = new LinkedHashMap<>();
        for (String day : days) {
            List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
            grid.put(day, hours);
        }
        return grid;
    }

    private Map<String, List<Integer>> gridForPreset(String preset) {
        Map<String, List<Integer>> grid = defaultGrid();
        return switch (preset) {
            case "SCHOOL" -> {
                // Block 8am-4pm Mon-Fri
                List<String> weekdays = List.of("monday","tuesday","wednesday","thursday","friday");
                for (String day : weekdays) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
                    for (int h = 8; h < 16; h++) hours.set(h, 1);
                    grid.put(day, hours);
                }
                yield grid;
            }
            case "BEDTIME" -> {
                // Block 10pm-7am every day
                for (String day : grid.keySet()) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
                    for (int h = 22; h < 24; h++) hours.set(h, 1);
                    for (int h = 0; h < 7; h++) hours.set(h, 1);
                    grid.put(day, hours);
                }
                yield grid;
            }
            case "STRICT" -> {
                // Block 8am-4pm weekdays + 10pm-7am all days
                List<String> weekdays = List.of("monday","tuesday","wednesday","thursday","friday");
                for (String day : grid.keySet()) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, 0));
                    if (weekdays.contains(day)) for (int h = 8; h < 16; h++) hours.set(h, 1);
                    for (int h = 22; h < 24; h++) hours.set(h, 1);
                    for (int h = 0; h < 7; h++) hours.set(h, 1);
                    grid.put(day, hours);
                }
                yield grid;
            }
            case "WEEKEND" -> {
                // Weekdays fully blocked, weekends fully open
                List<String> weekdays = List.of("monday","tuesday","wednesday","thursday","friday");
                for (String day : grid.keySet()) {
                    List<Integer> hours = new ArrayList<>(Collections.nCopies(24, weekdays.contains(day) ? 1 : 0));
                    grid.put(day, hours);
                }
                yield grid;
            }
            default -> grid;
        };
    }

    private ScheduleResponse toResponse(Schedule s) {
        return ScheduleResponse.builder()
                .profileId(s.getProfileId())
                .grid(s.getGrid())
                .activePreset(s.getActivePreset())
                .overrideActive(s.getOverrideActive())
                .overrideType(s.getOverrideType())
                .overrideEndsAt(s.getOverrideEndsAt())
                .build();
    }
}
