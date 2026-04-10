package com.rstglobal.shield.auth.repository;

import com.rstglobal.shield.auth.entity.PasswordHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PasswordHistoryRepository extends JpaRepository<PasswordHistory, UUID> {

    /** Returns the most recent N password history rows for the given user (ordered newest first). */
    List<PasswordHistory> findTop5ByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Deletes old password history rows keeping only the most recent {@code keep} entries.
     * Runs as a native query because JPQL does not support LIMIT in DELETE.
     */
    @Modifying
    @Query(value = """
        DELETE FROM auth.password_history
        WHERE user_id = :userId
          AND id NOT IN (
              SELECT id FROM auth.password_history
              WHERE user_id = :userId
              ORDER BY created_at DESC
              LIMIT :keep
          )
        """, nativeQuery = true)
    void deleteOldEntries(@Param("userId") UUID userId, @Param("keep") int keep);
}
