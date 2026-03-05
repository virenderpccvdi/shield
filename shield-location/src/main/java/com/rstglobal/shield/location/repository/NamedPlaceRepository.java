package com.rstglobal.shield.location.repository;

import com.rstglobal.shield.location.entity.NamedPlace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NamedPlaceRepository extends JpaRepository<NamedPlace, UUID> {

    List<NamedPlace> findByProfileIdOrderByCreatedAtDesc(UUID profileId);

    List<NamedPlace> findByProfileIdAndIsActiveTrue(UUID profileId);
}
