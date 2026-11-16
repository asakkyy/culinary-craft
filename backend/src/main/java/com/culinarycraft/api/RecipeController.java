package com.culinarycraft.api;

import com.culinarycraft.model.*;
import com.culinarycraft.service.RecipeService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {
    private final RecipeService recipes;
    public RecipeController(RecipeService recipes) { this.recipes = recipes; }

    @GetMapping
    public Map<String, Object> catalog(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "Все рецепты") String category,
        @RequestParam(defaultValue = "popular") String sort,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "6") int size,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId
    ) { return recipes.catalog(search, category, sort, page, size, userId); }

    @GetMapping("/mine")
    public List<RecipeView> mine(@RequestHeader(value = "X-Demo-User", required = false) Long id) {
        return recipes.mine(id);
    }

    @GetMapping("/favorites")
    public List<RecipeView> favorites(@RequestHeader(value = "X-Demo-User", required = false) Long id) {
        return recipes.favorites(id);
    }

    @GetMapping("/pending")
    public List<RecipeView> pending(@RequestHeader(value = "X-Demo-User", required = false) Long id) {
        return recipes.pending(id);
    }

    @GetMapping("/{id}")
    public RecipeView recipe(@PathVariable long id,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        return recipes.get(id, userId);
    }

    @PostMapping
    public RecipeView create(@Valid @RequestBody RecipeRequest request,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        return recipes.create(request, userId);
    }

    @PutMapping("/{id}")
    public RecipeView update(@PathVariable long id, @Valid @RequestBody RecipeRequest request,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        return recipes.update(id, request, userId);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        recipes.delete(id, userId);
    }

    @PostMapping("/{id}/favorite")
    public Map<String, Boolean> favorite(@PathVariable long id,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        return Map.of("favorite", recipes.toggleFavorite(id, userId));
    }

    @GetMapping("/{id}/reviews")
    public List<Review> reviews(@PathVariable long id) { return recipes.reviews(id); }

    @PostMapping("/{id}/reviews")
    public Review review(@PathVariable long id, @Valid @RequestBody ReviewRequest request,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        return recipes.review(id, request, userId);
    }

    @PostMapping("/{id}/moderate")
    public RecipeView moderate(@PathVariable long id, @RequestBody Map<String, String> payload,
        @RequestHeader(value = "X-Demo-User", required = false) Long userId) {
        return recipes.moderate(id, payload.get("status"), userId);
    }
}
