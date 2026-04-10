package com.rstglobal.shield.analytics.util;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class DateRangeUtils {

    private DateRangeUtils() {}

    public record DateRange(Instant from, Instant to) {
        /** Convenience: returns as a two-element array for callers that use Instant[]. */
        public Instant[] toArray() {
            return new Instant[]{from, to};
        }
    }

    /**
     * Converts a period string to a [from, to] range ending at now.
     * Default (null or unrecognised) is today (midnight to now).
     */
    public static DateRange fromPeriod(String period) {
        Instant now = Instant.now();
        Instant from = switch (period == null ? "today" : period.toLowerCase()) {
            case "week",  "7d"  -> now.minus(7,   ChronoUnit.DAYS);
            case "month", "30d" -> now.minus(30,  ChronoUnit.DAYS);
            case "quarter"      -> now.minus(90,  ChronoUnit.DAYS);
            case "year"         -> now.minus(365, ChronoUnit.DAYS);
            default             -> now.truncatedTo(ChronoUnit.DAYS); // today: midnight to now
        };
        return new DateRange(from, now);
    }
}
