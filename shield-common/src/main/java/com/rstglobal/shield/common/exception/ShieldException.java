package com.rstglobal.shield.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ShieldException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    public ShieldException(String errorCode, String message, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public static ShieldException notFound(String resource, Object id) {
        // Convert resource name to SCREAMING_SNAKE_CASE (e.g. "SubscriptionPlan" → "SUBSCRIPTION_PLAN_NOT_FOUND")
        String code = resource.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase() + "_NOT_FOUND";
        return new ShieldException(code, resource + " not found: " + id, HttpStatus.NOT_FOUND);
    }

    public static ShieldException conflict(String message) {
        return new ShieldException("CONFLICT", message, HttpStatus.CONFLICT);
    }

    public static ShieldException forbidden() {
        return new ShieldException("FORBIDDEN", "Access denied", HttpStatus.FORBIDDEN);
    }

    public static ShieldException forbidden(String message) {
        return new ShieldException("FORBIDDEN", message, HttpStatus.FORBIDDEN);
    }

    public static ShieldException badRequest(String message) {
        return new ShieldException("BAD_REQUEST", message, HttpStatus.BAD_REQUEST);
    }
}
