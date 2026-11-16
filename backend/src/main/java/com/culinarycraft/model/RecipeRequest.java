package com.culinarycraft.model;

import jakarta.validation.constraints.*;
import java.util.List;

public record RecipeRequest(
    @NotBlank @Size(min = 3, max = 100) String title,
    @NotBlank @Size(min = 15, max = 1500) String description,
    @NotBlank String category,
    String emoji,
    String imageUrl,
    @Min(1) @Max(1440) int prepMinutes,
    @Min(1) @Max(30) int servings,
    @NotBlank String difficulty,
    @NotEmpty List<@NotBlank String> ingredients,
    @NotEmpty List<@NotBlank String> steps,
    List<String> tags
) {}
