package com.rstglobal.shield.analytics.dto.response;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TopDomainEntry {

    private String domain;
    private long count;
    private String action;
    private String rootDomain;
    private String appName;
    private String category;

    /** Legacy constructor used internally for PDF report & tests. */
    public TopDomainEntry(String domain, long count, String action) {
        this.domain = domain;
        this.count = count;
        this.action = action;
    }

    public TopDomainEntry(String domain, long count, String action,
                          String rootDomain, String appName, String category) {
        this.domain = domain;
        this.count = count;
        this.action = action;
        this.rootDomain = rootDomain;
        this.appName = appName;
        this.category = category;
    }
}
