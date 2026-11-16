package com.culinarycraft.model;

import java.time.Instant;

public record Review(long id, long recipeId, long authorId, String authorName, int rating,
                     String comment, Instant createdAt) {}
