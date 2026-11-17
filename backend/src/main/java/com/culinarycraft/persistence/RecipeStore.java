package com.culinarycraft.persistence;

import com.culinarycraft.model.Recipe;
import com.culinarycraft.model.Review;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Repository;

/** Maps persistence entities to the existing API-independent records inside service transactions. */
@Repository
public class RecipeStore {
    private final RecipeRepository recipes;
    private final ReviewRepository reviews;
    private final FavoriteRepository favorites;
    private final DemoUserRepository users;
    private final com.culinarycraft.media.MediaService media;

    public RecipeStore(RecipeRepository recipes, ReviewRepository reviews,
                       FavoriteRepository favorites, DemoUserRepository users, com.culinarycraft.media.MediaService media) {
        this.recipes = recipes; this.reviews = reviews;
        this.favorites = favorites; this.users = users;
        this.media = media;
    }

    public List<Recipe> all() { return recipes.findAll().stream().map(RecipeEntity::toModel).toList(); }
    public Optional<Recipe> get(long id) { return recipes.findById(id).map(RecipeEntity::toModel); }
    public Optional<Recipe> lock(long id) { return recipes.findForUpdate(id).map(RecipeEntity::toModel); }

    public Recipe save(Recipe recipe) {
        RecipeEntity entity;
        if (recipe.id() == 0) {
            entity = RecipeEntity.create(recipe, users.getReferenceById(recipe.ownerId()));
        } else {
            entity = recipes.getReferenceById(recipe.id());
            entity.apply(recipe);
        }
        return recipes.save(entity).toModel();
    }

    public void delete(long id) { media.deleteForRecipe(id); recipes.deleteById(id); }
    public List<Review> reviews(long id) {
        return reviews.findByRecipeIdOrderByCreatedAtDescIdDesc(id).stream().map(ReviewEntity::toModel).toList();
    }
    public Review addReview(long recipeId, long userId, int rating, String comment) {
        return reviews.save(new ReviewEntity(recipes.getReferenceById(recipeId), users.getReferenceById(userId),
            rating, comment, Instant.now())).toModel();
    }
    public Set<Long> favorites(long userId) { return favorites.recipeIds(userId); }
    public boolean isFavorite(long recipeId, Long userId) {
        return userId != null && favorites.existsByUserIdAndRecipeId(userId, recipeId);
    }
    public boolean toggleFavorite(long recipeId, long userId) {
        if (isFavorite(recipeId, userId)) {
            favorites.deleteByUserIdAndRecipeId(userId, recipeId);
            return false;
        }
        favorites.save(new FavoriteEntity(users.getReferenceById(userId), recipes.getReferenceById(recipeId)));
        return true;
    }
}
