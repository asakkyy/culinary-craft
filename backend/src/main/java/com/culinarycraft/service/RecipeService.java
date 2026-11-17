package com.culinarycraft.service;

import com.culinarycraft.model.*;
import java.time.Instant;
import java.util.*;
import com.culinarycraft.persistence.RecipeStore;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Business rules and API views backed by PostgreSQL. */
@Service
@Transactional(readOnly = true)
public class RecipeService {
    private final DemoUserService users;
    private final RecipeStore store;
    private final com.culinarycraft.admin.AuditService audit;

    public RecipeService(DemoUserService users, RecipeStore store, com.culinarycraft.admin.AuditService audit) {
        this.users = users;
        this.store = store;
        this.audit = audit;
    }

    public Map<String, Object> catalog(String search, String category, String sort,
                                        int page, int size, Long userId) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(30, size));
        String text = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        List<Recipe> matching = store.all().stream()
            .filter(r -> "APPROVED".equals(r.status()))
            .filter(r -> category == null || category.equals("Все рецепты") || category.isBlank()
                || category.equalsIgnoreCase(r.category()))
            .filter(r -> text.isEmpty() || (r.title() + " " + r.description() + " "
                + String.join(" ", r.tags())).toLowerCase(Locale.ROOT).contains(text))
            .sorted(comparator(sort)).toList();
        int from = (int) Math.min((long) safePage * safeSize, matching.size());
        int to = Math.min(from + safeSize, matching.size());
        return Map.of("content", matching.subList(from, to).stream().map(r -> view(r, userId)).toList(),
            "total", matching.size(), "page", safePage, "size", safeSize,
            "totalPages", (matching.size() + safeSize - 1) / safeSize);
    }

    private Comparator<Recipe> comparator(String sort) {
        return switch (sort == null ? "" : sort) {
            case "newest" -> Comparator.comparing(Recipe::createdAt).reversed();
            case "quick" -> Comparator.comparingInt(Recipe::prepMinutes);
            case "rating" -> Comparator.<Recipe>comparingDouble(this::average).reversed();
            default -> Comparator.<Recipe>comparingDouble(this::average).reversed()
                .thenComparing(Recipe::createdAt, Comparator.reverseOrder());
        };
    }

    public RecipeView get(long id, Long userId) {
        Recipe recipe = required(id);
        DemoUser user = users.optional(userId);
        boolean authorized = user != null && (user.admin() || user.id() == recipe.ownerId());
        if (!"APPROVED".equals(recipe.status()) && !authorized) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Рецепт не найден");
        }
        return view(recipe, userId);
    }

    public List<RecipeView> mine(Long userId) {
        DemoUser user = users.requireUser(userId);
        return store.all().stream().filter(r -> r.ownerId() == user.id())
            .sorted(Comparator.comparing(Recipe::createdAt).reversed())
            .map(r -> view(r, userId)).toList();
    }

    public List<RecipeView> favorites(Long userId) {
        DemoUser user = users.requireUser(userId);
        Set<Long> saved = store.favorites(user.id());
        return store.all().stream().filter(r -> saved.contains(r.id()))
            .filter(r -> "APPROVED".equals(r.status()))
            .sorted(Comparator.comparing(Recipe::createdAt).reversed())
            .map(r -> view(r, userId)).toList();
    }

    public List<RecipeView> pending(Long userId) {
        users.requireAdmin(userId);
        return store.all().stream().filter(r -> "PENDING".equals(r.status()))
            .sorted(Comparator.comparing(Recipe::createdAt).reversed())
            .map(r -> view(r, userId)).toList();
    }

    @Transactional
    public RecipeView create(RecipeRequest request, Long userId) {
        DemoUser user = users.requireUser(userId);
        validateCategory(request.category());
        long id = 0;
        Recipe recipe = fromRequest(id, request, user, "PENDING", Instant.now());
        return view(store.save(recipe), userId);
    }

    @Transactional
    public RecipeView update(long id, RecipeRequest request, Long userId) {
        DemoUser user = users.requireUser(userId);
        Recipe before = locked(id);
        if (user.id() != before.ownerId() && !user.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Редактировать можно только свой рецепт");
        }
        validateCategory(request.category());
        DemoUser owner = users.requireUser(before.ownerId());
        Recipe changed = fromRequest(id, request, owner, "PENDING", before.createdAt());
        return view(store.save(changed), userId);
    }

    @Transactional
    public void delete(long id, Long userId) {
        DemoUser user = users.requireUser(userId);
        Recipe recipe = locked(id);
        if (user.id() != recipe.ownerId() && !user.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Удалить можно только свой рецепт");
        }
        store.delete(id);
    }

    @Transactional
    public boolean toggleFavorite(long id, Long userId) {
        DemoUser user = users.requireUser(userId);
        if (!"APPROVED".equals(locked(id).status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "В избранное добавляются только опубликованные рецепты");
        }
        return store.toggleFavorite(id, user.id());
    }

    public List<Review> reviews(long recipeId) {
        Recipe r = required(recipeId);
        if (!"APPROVED".equals(r.status())) {
            return List.of();
        }
        return store.reviews(recipeId);
    }

    @Transactional
    public Review review(long recipeId, ReviewRequest request, Long userId) {
        DemoUser user = users.requireUser(userId);
        Recipe recipe = locked(recipeId);
        if (!"APPROVED".equals(recipe.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Нельзя оценивать неопубликованный рецепт");
        }
        List<Review> list = store.reviews(recipeId);
        if (list.stream().anyMatch(r -> r.authorId() == user.id())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Вы уже оценивали этот рецепт");
        }
        return store.addReview(recipeId, user.id(), request.rating(), request.comment().strip());
    }

    @Transactional
    public RecipeView moderate(long id, String status, Long userId) {
        users.requireAdmin(userId);
        if (!"APPROVED".equals(status) && !"REJECTED".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Допустимые статусы: APPROVED и REJECTED");
        }
        Recipe r = locked(id);
        if (!"PENDING".equals(r.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "На модерации может находиться только ожидающий рецепт");
        }
        Recipe changed = new Recipe(r.id(), r.title(), r.description(), r.category(), r.emoji(),
            r.imageUrl(), r.prepMinutes(), r.servings(), r.difficulty(), r.ingredients(),
            r.steps(), r.tags(), r.ownerId(), r.ownerName(), status, r.createdAt());
        audit.record(userId, "APPROVED".equals(status) ? com.culinarycraft.admin.AuditEvent.Action.RECIPE_APPROVED
            : com.culinarycraft.admin.AuditEvent.Action.RECIPE_REJECTED, "RECIPE", id, "Status: " + status);
        return view(store.save(changed), userId);
    }

    private Recipe required(long id) {
        return store.get(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Рецепт не найден"));
    }

    private Recipe locked(long id) {
        return store.lock(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Рецепт не найден"));
    }

    private void validateCategory(String category) {
        if (!List.of("Завтраки", "Основные блюда", "Десерты", "Салаты", "Супы", "Напитки").contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная категория рецепта");
        }
    }

    private Recipe fromRequest(long id, RecipeRequest request, DemoUser user, String status, Instant createdAt) {
        if (request.imageUrl() != null && request.imageUrl().strip().startsWith("/api/media/")
            && (id == 0 || !required(id).imageUrl().equals(request.imageUrl().strip()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Управляемые фотографии изменяются только через загрузку файла");
        }
        return new Recipe(id, request.title().strip(), request.description().strip(), request.category(),
            request.emoji() == null || request.emoji().isBlank() ? "🍽️" : request.emoji(),
            request.imageUrl() == null ? "" : request.imageUrl().strip(), request.prepMinutes(),
            request.servings(), request.difficulty(), List.copyOf(request.ingredients()),
            List.copyOf(request.steps()), request.tags() == null ? List.of() : List.copyOf(request.tags()),
            user.id(), user.name(), status, createdAt);
    }

    private RecipeView view(Recipe r, Long userId) {
        List<Review> list = store.reviews(r.id());
        return new RecipeView(r.id(), r.title(), r.description(), r.category(), r.emoji(), r.imageUrl(),
            r.prepMinutes(), r.servings(), r.difficulty(), r.ingredients(), r.steps(), r.tags(),
            r.ownerId(), r.ownerName(), r.status(), r.createdAt(), average(r), list.size(),
            store.isFavorite(r.id(), userId));
    }

    private double average(Recipe r) {
        List<Review> list = store.reviews(r.id());
        if (list.isEmpty()) return 0;
        double mean = list.stream().mapToInt(Review::rating).average().orElse(0);
        return Math.round(mean * 10.0) / 10.0;
    }

}
