package com.rstglobal.shield.dns.repository;

import com.rstglobal.shield.dns.entity.FilterCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FilterCategoryRepository extends JpaRepository<FilterCategory, String> {
    Optional<FilterCategory> findByCategoryKey(String categoryKey);
    List<FilterCategory> findAllByOrderByDisplayOrderAsc();
}
