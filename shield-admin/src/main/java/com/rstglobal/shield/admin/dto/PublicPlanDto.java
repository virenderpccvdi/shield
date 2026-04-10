package com.rstglobal.shield.admin.dto;

import com.rstglobal.shield.admin.entity.SubscriptionPlan;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Slim read-only DTO for the public marketing pricing page.
 * Does NOT expose Stripe IDs, tenant IDs, or internal flags.
 */
public record PublicPlanDto(
        UUID id,
        String name,
        String displayName,
        BigDecimal price,
        String currency,
        String billingInterval,
        List<String> features,
        int maxProfiles,
        boolean highlighted
) {
    public static PublicPlanDto from(SubscriptionPlan plan) {
        List<String> featureList = toFeatureList(plan.getFeatures());
        // Mark the default plan as highlighted so the website can render it prominently
        boolean highlight = Boolean.TRUE.equals(plan.getIsDefault());
        return new PublicPlanDto(
                plan.getId(),
                plan.getName(),
                plan.getDisplayName(),
                plan.getPrice(),
                "INR",
                plan.getBillingCycle(),
                featureList,
                plan.getMaxProfilesPerCustomer() != null ? plan.getMaxProfilesPerCustomer() : 5,
                highlight
        );
    }

    /** Convert features map (key → enabled) into a display list of enabled feature names. */
    private static List<String> toFeatureList(Map<String, Boolean> features) {
        if (features == null || features.isEmpty()) return List.of();
        List<String> result = new ArrayList<>();
        features.forEach((key, enabled) -> {
            if (Boolean.TRUE.equals(enabled)) {
                // Convert camelCase key to human-readable label
                result.add(toLabel(key));
            }
        });
        return result;
    }

    private static String toLabel(String key) {
        // e.g. "dnsFiltering" → "DNS Filtering", "locationTracking" → "Location Tracking"
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            if (i == 0) {
                sb.append(Character.toUpperCase(c));
            } else if (Character.isUpperCase(c)) {
                sb.append(' ').append(c);
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
