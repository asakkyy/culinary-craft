package com.culinarycraft.persistence;

import com.culinarycraft.model.Review;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "reviews", uniqueConstraints = @UniqueConstraint(columnNames = {"recipe_id", "author_id"}))
public class ReviewEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false) private RecipeEntity recipe;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false) private DemoUserEntity author;
    @Column(nullable = false) private int rating;
    @Column(nullable = false, length = 500) private String comment;
    @Column(nullable = false) private Instant createdAt;

    protected ReviewEntity() {}

    public ReviewEntity(RecipeEntity recipe, DemoUserEntity author, int rating, String comment, Instant createdAt) {
        this.recipe = recipe; this.author = author; this.rating = rating;
        this.comment = comment; this.createdAt = createdAt;
    }

    public Review toModel() {
        var user = author.toModel();
        return new Review(id, recipe.getId(), user.id(), user.name(), rating, comment, createdAt);
    }
}
