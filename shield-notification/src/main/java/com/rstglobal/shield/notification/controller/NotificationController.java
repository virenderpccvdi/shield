package com.rstglobal.shield.notification.controller;

import com.rstglobal.shield.common.dto.ApiResponse;
import com.rstglobal.shield.notification.dto.response.NotificationResponse;
import com.rstglobal.shield.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notifService;

    /** Paged notification history for the authenticated user. */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<Page<NotificationResponse>>> getMyNotifications(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(
                notifService.getMyNotifications(UUID.fromString(userId), page, size)));
    }

    /** Unread notifications only — for mobile polling. */
    @GetMapping("/my/unread")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getUnread(
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(ApiResponse.ok(
                notifService.getUnread(UUID.fromString(userId))));
    }

    /** Unread count badge. */
    @GetMapping("/my/unread/count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(ApiResponse.ok(
                notifService.getUnreadCount(UUID.fromString(userId))));
    }

    /** Mark a single notification as read. */
    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markRead(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") String userId) {
        notifService.markRead(id, UUID.fromString(userId));
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    /** Mark all notifications as read. */
    @PutMapping("/my/read-all")
    public ResponseEntity<ApiResponse<Integer>> markAllRead(
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(ApiResponse.ok(
                notifService.markAllRead(UUID.fromString(userId))));
    }
}
