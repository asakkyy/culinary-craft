package com.culinarycraft.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<ReviewEntity, Long> {
    List<ReviewEntity> findByRecipeIdOrderByCreatedAtDescIdDesc(long recipeId);
}
