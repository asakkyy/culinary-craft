package com.culinarycraft.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "favorites", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "recipe_id"}))
public class FavoriteEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private DemoUserEntity user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false) private RecipeEntity recipe;

    protected FavoriteEntity() {}

    public FavoriteEntity(DemoUserEntity user, RecipeEntity recipe) {
        this.user = user; this.recipe = recipe;
    }
}
