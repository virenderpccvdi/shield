package com.rstglobal.shield.location.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The result of a spoofing analysis for a single location upload.
 *
 * @param profileId    The child profile that uploaded the location
 * @param isSuspicious True if at least one spoofing signal was detected
 * @param signals      List of individual signals that triggered
 * @param detectedAt   When the analysis was performed
 */
public record SpoofingResult(
        UUID profileId,
        boolean isSuspicious,
        List<SpoofingSignal> signals,
        OffsetDateTime detectedAt
) {
    public SpoofingResult(UUID profileId, boolean isSuspicious, List<SpoofingSignal> signals) {
        this(profileId, isSuspicious, signals, OffsetDateTime.now());
    }
}
