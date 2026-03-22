package com.rstglobal.shield.location.dto.request;

import lombok.Data;

@Data
public class CheckinReminderRequest {

    private Boolean enabled;

    /** How many minutes of silence trigger an alert. Suggested values: 15, 30, 60, 120. */
    private Integer reminderIntervalMin;

    /** Start of the quiet window in "HH:mm" format, or null to disable quiet hours. */
    private String quietStart;

    /** End of the quiet window in "HH:mm" format, or null to disable quiet hours. */
    private String quietEnd;
}
