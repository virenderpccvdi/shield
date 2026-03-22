package com.rstglobal.shield.notification.repository;

import com.rstglobal.shield.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Notification> findByUserIdAndStatusInOrderByCreatedAtDesc(UUID userId, List<String> statuses);

    long countByUserIdAndStatus(UUID userId, String status);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.userId = :userId AND n.status IN ('PENDING','DELIVERED')")
    long countUnreadByUserId(UUID userId);

    @Modifying
    @Query("UPDATE Notification n SET n.status = 'READ', n.readAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.status IN ('PENDING','DELIVERED')")
    int markAllReadByUserId(UUID userId);
}
