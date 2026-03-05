package com.rstglobal.shield.rewards.dto.request;

import lombok.Data;

/**
 * Request payload when a child submits a task for approval.
 * Body is optional – the taskId and profileId come from path/header.
 */
@Data
public class TaskSubmitRequest {

    /** Optional note or proof from the child */
    private String note;
}
