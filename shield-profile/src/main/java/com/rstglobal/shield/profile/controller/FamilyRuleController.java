package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.CreateFamilyRuleRequest;
import com.rstglobal.shield.profile.dto.request.ReorderFamilyRulesRequest;
import com.rstglobal.shield.profile.dto.request.UpdateFamilyRuleRequest;
import com.rstglobal.shield.profile.dto.response.FamilyRuleResponse;
import com.rstglobal.shield.profile.entity.Customer;
import com.rstglobal.shield.profile.repository.ChildProfileRepository;
import com.rstglobal.shield.profile.repository.CustomerRepository;
import com.rstglobal.shield.profile.service.FamilyRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/profiles/family-rules")
@RequiredArgsConstructor
public class FamilyRuleController {

    private final FamilyRuleService service;
    private final CustomerRepository customerRepository;

    /**
     * GET /api/v1/profiles/family-rules?customerId={id}
     * Returns active rules for a customer, ordered by sortOrder.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<FamilyRuleResponse>>> getRules(
            @RequestParam UUID customerId,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        List<FamilyRuleResponse> rules = includeInactive
                ? service.getAllRules(customerId)
                : service.getRules(customerId);
        return ResponseEntity.ok(ApiResponse.ok(rules));
    }

    /**
     * POST /api/v1/profiles/family-rules
     * Creates a new family rule. customerId resolved from X-User-Id header if not in body.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<FamilyRuleResponse>> createRule(
            @Valid @RequestBody CreateFamilyRuleRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        UUID customerId = resolveCustomerId(req.getCustomerId(), userId);
        FamilyRuleResponse created = service.createRule(customerId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created));
    }

    /**
     * PUT /api/v1/profiles/family-rules/{ruleId}
     * Updates an existing rule.
     */
    @PutMapping("/{ruleId}")
    public ResponseEntity<ApiResponse<FamilyRuleResponse>> updateRule(
            @PathVariable UUID ruleId,
            @Valid @RequestBody UpdateFamilyRuleRequest req,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        UUID customerId = resolveCustomerIdFromUserId(userId);
        FamilyRuleResponse updated = service.updateRule(ruleId, customerId, req);
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    /**
     * DELETE /api/v1/profiles/family-rules/{ruleId}
     */
    @DeleteMapping("/{ruleId}")
    public ResponseEntity<ApiResponse<Void>> deleteRule(
            @PathVariable UUID ruleId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {

        UUID customerId = resolveCustomerIdFromUserId(userId);
        service.deleteRule(ruleId, customerId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Rule deleted"));
    }

    /**
     * POST /api/v1/profiles/family-rules/reorder
     * Body: { "customerId": "...", "orderedIds": ["id1", "id2"] }
     */
    @PostMapping("/reorder")
    public ResponseEntity<ApiResponse<Void>> reorder(
            @Valid @RequestBody ReorderFamilyRulesRequest req) {
        service.reorder(req.getCustomerId(), req.getOrderedIds());
        return ResponseEntity.ok(ApiResponse.ok(null, "Rules reordered"));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private UUID resolveCustomerId(UUID bodyCustomerId, String userId) {
        if (bodyCustomerId != null) return bodyCustomerId;
        return resolveCustomerIdFromUserId(userId);
    }

    private UUID resolveCustomerIdFromUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw ShieldException.badRequest("X-User-Id header is required");
        }
        UUID userUuid;
        try {
            userUuid = UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            throw ShieldException.badRequest("Invalid X-User-Id header");
        }
        Customer customer = customerRepository.findByUserId(userUuid)
                .orElseThrow(() -> ShieldException.notFound("customer", userId));
        return customer.getId();
    }
}
