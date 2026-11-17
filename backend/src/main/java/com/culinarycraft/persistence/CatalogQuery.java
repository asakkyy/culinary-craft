package com.culinarycraft.persistence;

import com.culinarycraft.model.RecipeView;
import jakarta.persistence.EntityManager;
import java.sql.Types;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.stereotype.Repository;

/** Filters, ordering, counts, rating aggregates and LIMIT/OFFSET run in PostgreSQL. */
@Repository
public class CatalogQuery {
    private record Summary(long id, double rating, int reviews, boolean favorite) {}
    private final NamedParameterJdbcTemplate jdbc;
    private final RecipeRepository recipes;
    private final EntityManager entities;
    public CatalogQuery(NamedParameterJdbcTemplate jdbc, RecipeRepository recipes, EntityManager entities) {
        this.jdbc = jdbc; this.recipes = recipes; this.entities = entities;
    }
    public Map<String, Object> page(String search, String category, String sort, int page, int size, Long viewer) {
        // JDBC queries share the JPA transaction, but do not themselves trigger Hibernate auto-flush.
        entities.flush();
        int safePage = Math.max(0, page), safeSize = Math.max(1, Math.min(30, size));
        var parameters = new MapSqlParameterSource().addValue("viewer", viewer, Types.BIGINT)
            .addValue("limit", safeSize).addValue("offset", (long) safePage * safeSize);
        String where = " where r.status = 'APPROVED'";
        if (category != null && !category.isBlank() && !category.equals("Все рецепты")) {
            where += " and lower(r.category) = :category"; parameters.addValue("category", category.toLowerCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            where += " and r.search_text like :search escape '!'";
            parameters.addValue("search", "%" + search.strip().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%")
                .replace("_", "!_") + "%");
        }
        String ordering = switch (sort == null ? "" : sort) {
            case "newest" -> "r.created_at desc, r.id desc";
            case "quick" -> "r.prep_minutes, r.id desc";
            case "rating" -> "coalesce(s.rating, 0) desc, r.id desc";
            default -> "coalesce(s.rating, 0) desc, r.created_at desc, r.id desc";
        };
        int total = Objects.requireNonNull(jdbc.queryForObject("select count(*) from recipes r" + where, parameters, Integer.class));
        var summaries = jdbc.query("""
            select r.id, coalesce(s.rating, 0) as rating, s.reviews,
              exists(select 1 from favorites f where f.recipe_id = r.id and f.user_id = :viewer) as favorite
            from recipes r left join lateral (
              select round(avg(v.rating), 1) as rating, count(*) as reviews from reviews v where v.recipe_id = r.id
            ) s on true
            """ + where + " order by " + ordering + " limit :limit offset :offset", parameters,
            (row, index) -> new Summary(row.getLong("id"), row.getDouble("rating"), row.getInt("reviews"), row.getBoolean("favorite")));
        var details = summaries.isEmpty() ? Map.<Long, RecipeEntity>of() : recipes.findWithOwnerByIdIn(summaries.stream().map(Summary::id).toList())
            .stream().collect(Collectors.toMap(RecipeEntity::getId, Function.identity()));
        var content = summaries.stream().map(summary -> {
            var r = details.get(summary.id()).toModel();
            return new RecipeView(r.id(), r.title(), r.description(), r.category(), r.emoji(), r.imageUrl(), r.prepMinutes(), r.servings(),
                r.difficulty(), r.ingredients(), r.steps(), r.tags(), r.ownerId(), r.ownerName(), r.status(), r.createdAt(),
                summary.rating(), summary.reviews(), summary.favorite());
        }).toList();
        return Map.of("content", content, "total", total, "page", safePage, "size", safeSize,
            "totalPages", (int) ((total + (long) safeSize - 1) / safeSize));
    }
}
