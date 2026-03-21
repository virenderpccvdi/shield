package com.rstglobal.shield.admin.dto;

import lombok.Data;

@Data
public class VisitorTrackRequest {
    private String sessionId;
    private String pagePath;
    private String referrer;
}
