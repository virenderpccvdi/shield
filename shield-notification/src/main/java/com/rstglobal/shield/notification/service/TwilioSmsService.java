package com.rstglobal.shield.notification.service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * SMS delivery via Twilio.
 *
 * Activated only when twilio.enabled=true (set TWILIO_ENABLED=true in .env).
 * Credentials are read from environment variables via application config:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "twilio.enabled", havingValue = "true")
public class TwilioSmsService {

    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    @Value("${twilio.from-number}")
    private String fromNumber;

    @PostConstruct
    public void init() {
        Twilio.init(accountSid, authToken);
        log.info("Twilio SMS service initialised with from={}", fromNumber);
    }

    /**
     * Send a plain SMS message to the given E.164 phone number.
     *
     * @param toNumber  E.164 formatted destination (e.g. +919876543210)
     * @param body      Message text (max 1600 chars; longer messages are split automatically by Twilio)
     * @return true if dispatched successfully, false on error
     */
    public boolean sendSms(String toNumber, String body) {
        if (toNumber == null || toNumber.isBlank()) {
            log.debug("sendSms skipped — no destination number provided");
            return false;
        }
        try {
            Message message = Message.creator(
                            new PhoneNumber(toNumber),
                            new PhoneNumber(fromNumber),
                            body)
                    .create();
            log.info("SMS sent to={} sid={} status={}", toNumber, message.getSid(), message.getStatus());
            return true;
        } catch (Exception e) {
            log.warn("SMS send failed to={}: {}", toNumber, e.getMessage());
            return false;
        }
    }

    /**
     * Send a high-priority SOS alert SMS to a parent's phone number.
     *
     * @param parentPhone  Parent's E.164 phone number
     * @param childName    Child's display name
     * @param lat          Latitude of the SOS trigger point
     * @param lng          Longitude of the SOS trigger point
     * @param address      Reverse-geocoded address (may be null if unavailable)
     */
    public boolean sendSosAlert(String parentPhone, String childName,
                                double lat, double lng, String address) {
        String location = (address != null && !address.isBlank())
                ? address
                : String.format("%.6f, %.6f", lat, lng);

        String mapsLink = String.format("https://maps.google.com/?q=%.6f,%.6f", lat, lng);

        String body = String.format(
                "SHIELD ALERT: %s has triggered SOS at %s. Open app immediately. " +
                "Map: %s",
                childName, location, mapsLink);

        return sendSms(parentPhone, body);
    }

    /**
     * Send a geofence breach alert SMS.
     *
     * @param parentPhone  Parent's E.164 phone number
     * @param childName    Child's display name
     * @param zoneName     Name of the geofence zone
     * @param eventType    "ENTER" or "EXIT"
     */
    public boolean sendGeofenceAlert(String parentPhone, String childName,
                                     String zoneName, String eventType) {
        String direction = "ENTER".equals(eventType) ? "entered" : "left";
        String body = String.format(
                "SHIELD ALERT: %s has %s the zone \"%s\". Open the Shield app for details.",
                childName, direction, zoneName);
        return sendSms(parentPhone, body);
    }
}
