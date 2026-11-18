package com.culinarycraft.admin;

import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<RecipeReport, Long> {
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RecipeReport r where r.id = :id")
    Optional<RecipeReport> lock(@Param("id") long id);
    Page<RecipeReport> findByReporterId(long id, Pageable page);
    long countByReporterIdAndCreatedAtAfter(long id, Instant after);
    boolean existsByReporterIdAndRecipeIdAndReasonAndStatusIn(long reporter, long recipe, RecipeReport.Reason reason, Collection<RecipeReport.Status> statuses);
    @Query("select r from RecipeReport r, DemoUserEntity u where u.id = r.reporterId "
        + "and (:status is null or r.status = :status) and lower(concat(r.recipeTitle, ' ', u.name, ' ', coalesce(u.email, ''))) like :search")
    Page<RecipeReport> search(@Param("status") RecipeReport.Status status, @Param("search") String search, Pageable page);
}
