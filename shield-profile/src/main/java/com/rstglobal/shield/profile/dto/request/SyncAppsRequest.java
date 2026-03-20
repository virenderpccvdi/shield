package com.rstglobal.shield.profile.dto.request;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class SyncAppsRequest {
    private UUID profileId;
    private List<AppEntry> apps;

    @Data
    public static class AppEntry {
        private String packageName;
        private String appName;
        private String versionName;
        private boolean systemApp;
        private int usageTodayMinutes;
    }
}
