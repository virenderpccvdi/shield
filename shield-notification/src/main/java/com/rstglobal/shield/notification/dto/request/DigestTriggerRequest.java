package com.rstglobal.shield.notification.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for manually triggering a weekly digest email.
 * Used by POST /internal/notifications/digest/trigger (test / admin use).
 */
public record DigestTriggerRequest(

        @NotBlank(message = "userId is required")
        String userId,

        @NotBlank(message = "email is required")
        @Email(message = "email must be a valid address")
        String email,

        @NotBlank(message = "parentName is required")
        String parentName
) {}
