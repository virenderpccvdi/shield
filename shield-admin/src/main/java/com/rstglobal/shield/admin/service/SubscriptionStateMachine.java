package com.rstglobal.shield.admin.service;

import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Set;

/**
 * Encodes valid subscription status transitions.
 *
 * State diagram:
 *   null / NONE ──► TRIAL ──► ACTIVE ──► PAST_DUE ──► SUSPENDED ──► CANCELLED
 *                      │         ▲                                       ▲
 *                      └─────────┘                                       │
 *                      (checkout)     (invoice.paid recovery)            │
 *                                                           (any → CANCELLED)
 *
 * Key rules:
 *   - SUSPENDED → ACTIVE is NOT allowed (user must re-subscribe)
 *   - Any status → CANCELLED is always allowed
 *   - TRIAL or null → ACTIVE on first successful payment
 */
@Slf4j
public final class SubscriptionStateMachine {

    // Status constants (stored as plain strings in the DB)
    public static final String TRIAL     = "TRIAL";
    public static final String ACTIVE    = "ACTIVE";
    public static final String PAST_DUE  = "PAST_DUE";
    public static final String SUSPENDED = "SUSPENDED";
    public static final String CANCELLED = "CANCELLED";
    public static final String NONE      = "NONE";

    private static final Map<String, Set<String>> ALLOWED = Map.of(
        NONE,      Set.of(TRIAL, ACTIVE),
        TRIAL,     Set.of(ACTIVE, CANCELLED),
        ACTIVE,    Set.of(PAST_DUE, CANCELLED),
        PAST_DUE,  Set.of(ACTIVE, SUSPENDED, CANCELLED),
        SUSPENDED, Set.of(CANCELLED),
        CANCELLED, Set.of()
    );

    private SubscriptionStateMachine() {}

    /**
     * Returns true if the transition from {@code current} → {@code next} is valid.
     * CANCELLED is always a valid target from any non-null state.
     */
    public static boolean isAllowed(String current, String next) {
        if (CANCELLED.equals(next)) return true;
        String from = current == null ? NONE : current;
        Set<String> allowed = ALLOWED.getOrDefault(from, Set.of());
        return allowed.contains(next);
    }

    /**
     * Validates and returns {@code next} if the transition is allowed.
     * Logs a warning and returns {@code current} unchanged if not allowed.
     */
    public static String transition(String current, String next, String context) {
        if (isAllowed(current, next)) {
            log.info("Subscription state transition: {} → {} [{}]", current, next, context);
            return next;
        }
        log.warn("Blocked invalid subscription transition: {} → {} [{}]", current, next, context);
        return current;
    }
}
