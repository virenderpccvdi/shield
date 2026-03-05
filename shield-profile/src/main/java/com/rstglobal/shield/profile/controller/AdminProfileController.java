package com.rstglobal.shield.profile.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.common.exception.ShieldException;
import com.rstglobal.shield.profile.dto.request.UpdateChildProfileRequest;
import com.rstglobal.shield.profile.dto.response.ChildProfileResponse;
import com.rstglobal.shield.profile.service.ChildProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles/admin/children")
@RequiredArgsConstructor
@Tag(name = "Admin Child Profiles", description = "Platform-wide child profile management")
public class AdminProfileController {

    private final ChildProfileService childProfileService;

    @GetMapping
    @Operation(summary = "List all child profiles (paginated)")
    public ApiResponse<Page<ChildProfileResponse>> listAll(
            @RequestHeader("X-User-Role") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(childProfileService.listAll(page, size, search));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get any child profile by ID")
    public ApiResponse<ChildProfileResponse> getById(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(childProfileService.getByIdAdmin(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update any child profile")
    public ApiResponse<ChildProfileResponse> update(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id,
            @RequestBody UpdateChildProfileRequest req) {
        requireGlobalAdmin(role);
        return ApiResponse.ok(childProfileService.updateAdmin(id, req));
    }

    @DeleteMapping("/{id}")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete any child profile")
    public void deleteProfile(
            @RequestHeader("X-User-Role") String role,
            @PathVariable UUID id) {
        requireGlobalAdmin(role);
        childProfileService.deleteAdmin(id);
    }

    private void requireGlobalAdmin(String role) {
        if (!"GLOBAL_ADMIN".equals(role)) {
            throw ShieldException.forbidden("GLOBAL_ADMIN role required");
        }
    }
}
