package com.rstglobal.shield.profile.service;

import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.SyncAppsRequest;
import com.rstglobal.shield.profile.dto.request.UpdateAppControlRequest;
import com.rstglobal.shield.profile.dto.response.DeviceAppResponse;
import com.rstglobal.shield.profile.entity.DeviceApp;
import com.rstglobal.shield.profile.repository.DeviceAppRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceAppService {

    private final DeviceAppRepository appRepository;

    /** Called by child device to sync installed apps + usage data */
    @Transactional
    public void syncApps(SyncAppsRequest req) {
        if (req.getApps() == null) return;
        for (SyncAppsRequest.AppEntry entry : req.getApps()) {
            appRepository.findByProfileIdAndPackageName(req.getProfileId(), entry.getPackageName())
                    .ifPresentOrElse(app -> {
                        app.setAppName(entry.getAppName());
                        app.setVersionName(entry.getVersionName());
                        app.setSystemApp(entry.isSystemApp());
                        app.setUsageTodayMinutes(entry.getUsageTodayMinutes());
                        app.setLastReportedAt(Instant.now());
                        appRepository.save(app);
                    }, () -> {
                        DeviceApp app = DeviceApp.builder()
                                .profileId(req.getProfileId())
                                .packageName(entry.getPackageName())
                                .appName(entry.getAppName())
                                .versionName(entry.getVersionName())
                                .systemApp(entry.isSystemApp())
                                .usageTodayMinutes(entry.getUsageTodayMinutes())
                                .lastReportedAt(Instant.now())
                                .build();
                        appRepository.save(app);
                    });
        }
        log.info("Synced {} apps for profile {}", req.getApps().size(), req.getProfileId());
    }

    public List<DeviceAppResponse> getAppsForProfile(UUID profileId) {
        return appRepository.findByProfileId(profileId).stream()
                .map(this::toResponse).toList();
    }

    public List<DeviceAppResponse> getBlockedApps(UUID profileId) {
        return appRepository.findByProfileIdAndBlockedTrue(profileId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public DeviceAppResponse updateAppControl(UUID profileId, String packageName, UpdateAppControlRequest req) {
        DeviceApp app = appRepository.findByProfileIdAndPackageName(profileId, packageName)
                .orElseThrow(() -> ShieldException.notFound("DeviceApp", packageName));
        if (req.getBlocked() != null) app.setBlocked(req.getBlocked());
        if (req.getTimeLimitMinutes() != null) app.setTimeLimitMinutes(req.getTimeLimitMinutes());
        return toResponse(appRepository.save(app));
    }

    private DeviceAppResponse toResponse(DeviceApp a) {
        return DeviceAppResponse.builder()
                .id(a.getId()).profileId(a.getProfileId()).packageName(a.getPackageName())
                .appName(a.getAppName()).versionName(a.getVersionName()).systemApp(a.isSystemApp())
                .blocked(a.isBlocked()).timeLimitMinutes(a.getTimeLimitMinutes())
                .usageTodayMinutes(a.getUsageTodayMinutes()).lastReportedAt(a.getLastReportedAt())
                .build();
    }
}
