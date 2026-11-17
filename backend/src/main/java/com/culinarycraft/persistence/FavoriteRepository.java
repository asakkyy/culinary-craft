package com.culinarycraft.persistence;

import java.util.Set;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface FavoriteRepository extends JpaRepository<FavoriteEntity, Long> {
    @Query("select f.recipe.id from FavoriteEntity f where f.user.id = :userId")
    Set<Long> recipeIds(@Param("userId") long userId);
    boolean existsByUserIdAndRecipeId(long userId, long recipeId);
    void deleteByUserIdAndRecipeId(long userId, long recipeId);
}
