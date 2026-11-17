package com.culinarycraft.persistence;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RecipeRepository extends JpaRepository<RecipeEntity, Long> {
    @EntityGraph(attributePaths = "owner")
    java.util.List<RecipeEntity> findWithOwnerByIdIn(java.util.Collection<Long> ids);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RecipeEntity r where r.id = :id")
    Optional<RecipeEntity> findForUpdate(@Param("id") long id);
}
