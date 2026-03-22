package com.rstglobal.shield.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TopAppEntry {

    /** Human-readable app name (e.g. "YouTube", "Instagram"). */
    private String appName;

    /** Canonical root domain for this app (e.g. "youtube.com"). */
    private String rootDomain;

    /** Total DNS query count within the requested period. */
    private long count;
}
