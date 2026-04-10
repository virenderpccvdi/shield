package com.rstglobal.shield.notification.dto.request;

import lombok.Data;

@Data
public class UpdatePreferenceRequest {
    private Boolean pushEnabled;
    private Boolean emailEnabled;
    private Boolean whatsappEnabled;
    private Boolean telegramEnabled;
    private Boolean quietHoursEnabled;
    private Integer quietStartHour;
    private Integer quietEndHour;
    private Boolean blockAlerts;
    private Boolean scheduleAlerts;
    private Boolean budgetAlerts;
    private Boolean extensionAlerts;
    private Boolean weeklyReportEnabled;
    private Boolean geofenceAlerts;
    private Boolean anomalyAlerts;
    private Boolean sosAlerts;
    private Boolean bedtimeAlerts;
    private String whatsappNumber;
    private String telegramChatId;
}
