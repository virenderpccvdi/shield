package com.rstglobal.shield.dnsresolver.model;

import lombok.Value;

@Value
public class BlockDecision {
    boolean blocked;
    String reason;

    public static BlockDecision blocked(String reason) {
        return new BlockDecision(true, reason);
    }

    public static BlockDecision allowed() {
        return new BlockDecision(false, null);
    }
}
