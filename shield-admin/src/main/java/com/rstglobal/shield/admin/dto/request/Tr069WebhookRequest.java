package com.rstglobal.shield.admin.dto.request;

import lombok.Data;

import java.util.Map;

@Data
public class Tr069WebhookRequest {

    private String deviceSerial;
    private String deviceModel;
    private String macAddress;
    private String ipAddress;
    private Map<String, Object> rawData;
}
