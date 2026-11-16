package com.culinarycraft.model;

import java.time.Instant;
import java.util.List;

public record RecipeView(
    long id, String title, String description, String category, String emoji,
    String imageUrl, int prepMinutes, int servings, String difficulty,
    List<String> ingredients, List<String> steps, List<String> tags,
    long ownerId, String ownerName, String status, Instant createdAt,
    double rating, int reviewCount, boolean favorite
) {}
