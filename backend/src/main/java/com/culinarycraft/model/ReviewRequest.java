package com.culinarycraft.model;

import jakarta.validation.constraints.*;

public record ReviewRequest(@Min(1) @Max(5) int rating,
                            @NotBlank @Size(min = 3, max = 500) String comment) {}
