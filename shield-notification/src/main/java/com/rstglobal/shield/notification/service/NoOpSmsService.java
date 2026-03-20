package com.rstglobal.shield.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

/**
 * No-op SMS service registered when Twilio is not enabled (twilio.enabled != true).
 * This satisfies any optional @Autowired(required = false) injection points and
 * ensures the notification dispatcher compiles cleanly regardless of Twilio config.
 */
@Slf4j
@Service
@ConditionalOnMissingBean(TwilioSmsService.class)
public class NoOpSmsService {

    public boolean sendSms(String toNumber, String body) {
        log.debug("SMS suppressed (Twilio disabled): to={}", toNumber);
        return false;
    }

    public boolean sendSosAlert(String parentPhone, String childName,
                                double lat, double lng, String address) {
        log.debug("SOS SMS suppressed (Twilio disabled): to={} child={}", parentPhone, childName);
        return false;
    }

    public boolean sendGeofenceAlert(String parentPhone, String childName,
                                     String zoneName, String eventType) {
        log.debug("Geofence SMS suppressed (Twilio disabled): to={} child={}", parentPhone, childName);
        return false;
    }
}
