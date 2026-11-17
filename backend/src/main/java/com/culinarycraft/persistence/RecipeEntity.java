package com.culinarycraft.persistence;

import com.culinarycraft.model.Recipe;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "recipes")
public class RecipeEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 100) private String title;
    @Column(nullable = false, length = 1500) private String description;
    @Column(nullable = false) private String category;
    @Column(nullable = false, columnDefinition = "text") private String emoji;
    @Column(nullable = false, columnDefinition = "text") private String imageUrl;
    @Column(nullable = false) private int prepMinutes;
    @Column(nullable = false) private int servings;
    @Column(nullable = false, columnDefinition = "text") private String difficulty;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false) private DemoUserEntity owner;
    @Column(nullable = false) private String status;
    @Column(nullable = false) private Instant createdAt;

    @ElementCollection
    @CollectionTable(name = "recipe_ingredients", joinColumns = @JoinColumn(name = "recipe_id"))
    @OrderColumn(name = "position")
    @Column(name = "value", nullable = false, columnDefinition = "text")
    private List<String> ingredients = new ArrayList<>();
    @ElementCollection
    @CollectionTable(name = "recipe_steps", joinColumns = @JoinColumn(name = "recipe_id"))
    @OrderColumn(name = "position")
    @Column(name = "value", nullable = false, columnDefinition = "text")
    private List<String> steps = new ArrayList<>();
    @ElementCollection
    @CollectionTable(name = "recipe_tags", joinColumns = @JoinColumn(name = "recipe_id"))
    @OrderColumn(name = "position")
    @Column(name = "value", nullable = false, columnDefinition = "text")
    private List<String> tags = new ArrayList<>();

    protected RecipeEntity() {}

    public long getId() { return id; }
    public void photo(String url) { imageUrl = url; status = "PENDING"; }

    public static RecipeEntity create(Recipe recipe, DemoUserEntity owner) {
        RecipeEntity entity = new RecipeEntity();
        entity.owner = owner;
        entity.apply(recipe);
        return entity;
    }

    public void apply(Recipe recipe) {
        title = recipe.title();
        description = recipe.description();
        category = recipe.category();
        emoji = recipe.emoji();
        if (imageUrl == null || !imageUrl.startsWith("/api/media/")) imageUrl = recipe.imageUrl();
        prepMinutes = recipe.prepMinutes();
        servings = recipe.servings();
        difficulty = recipe.difficulty();
        status = recipe.status();
        createdAt = recipe.createdAt();
        ingredients.clear(); ingredients.addAll(recipe.ingredients());
        steps.clear(); steps.addAll(recipe.steps());
        tags.clear(); tags.addAll(recipe.tags());
    }

    public Recipe toModel() {
        var user = owner.toModel();
        return new Recipe(id, title, description, category, emoji, imageUrl, prepMinutes,
            servings, difficulty, List.copyOf(ingredients), List.copyOf(steps), List.copyOf(tags),
            user.id(), user.name(), status, createdAt);
    }
}
