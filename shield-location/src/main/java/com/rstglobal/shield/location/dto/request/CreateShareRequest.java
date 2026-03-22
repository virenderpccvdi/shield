package com.rstglobal.shield.location.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateShareRequest {

    @NotNull
    private UUID profileId;

    /** Human-readable label, e.g. "Grandma's share" */
    private String label;

    /** Duration in hours. Suggested values: 1, 6, 24, 72, 168 */
    @NotNull
    private Integer durationHours;

    /** Maximum number of times the link may be viewed. Null = unlimited. */
    private Integer maxViews;
}
