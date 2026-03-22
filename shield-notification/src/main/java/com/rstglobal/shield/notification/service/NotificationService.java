package com.rstglobal.shield.notification.service;

import com.rstglobal.shield.notification.dto.request.SendNotificationRequest;
import com.rstglobal.shield.notification.dto.response.NotificationResponse;
import com.rstglobal.shield.notification.entity.Notification;
import com.rstglobal.shield.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notifRepo;
    private final NotificationDispatcher dispatcher;

    /**
     * Save notification to DB then dispatch asynchronously across all channels.
     * Called by other services via the internal endpoint.
     */
    @Transactional
    public NotificationResponse send(SendNotificationRequest req) {
        Notification n = Notification.builder()
                .tenantId(req.getTenantId())
                .userId(req.getUserId())
                .customerId(req.getCustomerId())
                .profileId(req.getProfileId())
                .type(req.getType())
                .title(req.getTitle())
                .body(req.getBody())
                .actionUrl(req.getActionUrl())
                .build();
        Notification saved = notifRepo.save(n);
        dispatchAsync(saved, req.getToEmail());
        return toResponse(saved);
    }

    @Async
    public void dispatchAsync(Notification notification, String toEmail) {
        dispatcher.dispatch(notification, toEmail);
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getMyNotifications(UUID userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return notifRepo.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getUnread(UUID userId) {
        return notifRepo.findByUserIdAndStatusInOrderByCreatedAtDesc(userId, List.of("PENDING", "DELIVERED"))
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notifRepo.countUnreadByUserId(userId);
    }

    @Transactional
    public void markRead(UUID notificationId, UUID userId) {
        notifRepo.findById(notificationId).ifPresent(n -> {
            if (n.getUserId().equals(userId)) {
                n.setStatus("READ");
                n.setReadAt(OffsetDateTime.now());
                notifRepo.save(n);
            }
        });
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return notifRepo.markAllReadByUserId(userId);
    }

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .body(n.getBody())
                .actionUrl(n.getActionUrl())
                .profileId(n.getProfileId())
                .status(n.getStatus())
                .createdAt(n.getCreatedAt())
                .readAt(n.getReadAt())
                .build();
    }
}
