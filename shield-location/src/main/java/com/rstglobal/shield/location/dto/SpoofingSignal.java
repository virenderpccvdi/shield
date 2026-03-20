package com.rstglobal.shield.location.dto;

/**
 * A single indicator of potential GPS spoofing.
 *
 * @param type        Machine-readable signal name (e.g. IMPOSSIBLE_SPEED, PERFECT_ACCURACY)
 * @param description Human-readable explanation of why this is suspicious
 */
public record SpoofingSignal(String type, String description) {
}
