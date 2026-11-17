package com.culinarycraft.service;

import static org.junit.jupiter.api.Assertions.*;

import com.culinarycraft.model.RecipeRequest;
import com.culinarycraft.model.ReviewRequest;
import com.culinarycraft.model.RecipeView;
import java.util.Comparator;
import java.util.List;
import com.culinarycraft.PostgresIntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Business rules against PostgreSQL without HTTP. */
class RecipeScenariosTest extends PostgresIntegrationTest {
    @Autowired private RecipeService service;


    private RecipeRequest request(String title) {
        return new RecipeRequest(title, "Домашнее блюдо с подробным и понятным описанием",
            "Супы", "🍜", "", 35, 3, "Легко", List.of("Вода", "Овощи"),
            List.of("Подготовить продукты", "Сварить до готовности"), List.of("Домашнее"));
    }

    private void assertStatus(HttpStatus expected, Runnable action) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, action::run);
        assertEquals(expected.value(), exception.getStatusCode().value());
    }

    @Test void catalogShowsOnlyApprovedRecipes() {
        var result = service.catalog("", "Все рецепты", "popular", 0, 30, null);
        assertEquals(8, result.get("total"));
        assertEquals(8, ((List<?>) result.get("content")).size());
    }

    @Test void catalogSearchAndCategoryFiltering() {
        assertEquals(0, service.catalog("невероятно_несуществующее", "Все рецепты", "popular", 0, 6, null).get("total"));
        assertEquals(0, service.catalog("", "Неизвестная категория", "popular", 0, 6, null).get("total"));
        assertTrue((int) service.catalog("", "Десерты", "popular", 0, 6, null).get("total") > 0);
    }

    @Test void catalogPaginationIsBounded() {
        var first = service.catalog("", "Все рецепты", "quick", 0, 3, null);
        var second = service.catalog("", "Все рецепты", "quick", 1, 3, null);
        assertEquals(3, ((List<?>) first.get("content")).size());
        assertEquals(3, ((List<?>) second.get("content")).size());
        assertEquals(3, first.get("totalPages"));
        assertEquals(0, ((List<?>) service.catalog("", "Все рецепты", "quick", 99, 3, null).get("content")).size());
        assertEquals(30, service.catalog("", "Все рецепты", "quick", -1, 100, null).get("size"));
        assertEquals(0, service.catalog("", "Все рецепты", "quick", -1, 0, null).get("page"));
        assertEquals(1, service.catalog("", "Все рецепты", "quick", -1, 0, null).get("size"));
    }

    @Test void allSortStrategiesAreAvailable() {
        for (String sort : List.of("newest", "popular", "quick", "rating")) {
            var result = service.catalog("", "Все рецепты", sort, 0, 30, null);
            assertEquals(8, result.get("total"));
            List<RecipeView> content = ((List<?>) result.get("content")).stream().map(RecipeView.class::cast).toList();
            Comparator<RecipeView> order = switch (sort) {
                case "newest" -> Comparator.comparing(RecipeView::createdAt).reversed();
                case "quick" -> Comparator.comparingInt(RecipeView::prepMinutes);
                case "rating" -> Comparator.comparingDouble(RecipeView::rating).reversed();
                default -> Comparator.comparingDouble(RecipeView::rating).reversed()
                    .thenComparing(RecipeView::createdAt, Comparator.reverseOrder());
            };
            assertEquals(content.stream().sorted(order).toList(), content);
        }
    }

    @Test void guestCannotCreateRecipeOrViewPending() {
        assertStatus(HttpStatus.UNAUTHORIZED, () -> service.create(request("Новый суп"), null));
        assertStatus(HttpStatus.NOT_FOUND, () -> service.get(9, null));
    }

    @Test void authorCanCreateAndSeePendingRecipe() {
        var created = service.create(request("Новый суп"), 1L);
        assertEquals("PENDING", created.status());
        assertTrue(service.mine(1L).stream().anyMatch(r -> r.id() == created.id()));
        assertFalse(((List<?>) service.catalog("Новый суп", "Все рецепты", "popular", 0, 30, null)
            .get("content")).stream().anyMatch(r -> r.equals(created)));
    }

    @Test void forbiddenEditAndDeleteAreRejected() {
        var created = service.create(request("Авторский суп"), 1L);
        assertStatus(HttpStatus.FORBIDDEN, () -> service.update(created.id(), request("Чужой суп"), 2L));
        assertStatus(HttpStatus.FORBIDDEN, () -> service.delete(created.id(), 2L));
    }

    @Test void ownerCanEditRecipeAndModerationResets() {
        var created = service.create(request("Авторский суп"), 1L);
        service.moderate(created.id(), "APPROVED", 3L);
        var edited = service.update(created.id(), request("Улучшенный суп"), 1L);
        assertEquals("Улучшенный суп", edited.title());
        assertEquals("PENDING", edited.status());
    }

    @Test void ownerCanDeleteRecipe() {
        var created = service.create(request("Удаляемый суп"), 1L);
        service.delete(created.id(), 1L);
        assertStatus(HttpStatus.NOT_FOUND, () -> service.get(created.id(), 1L));
    }

    @Test void unknownCategoryIsRejected() {
        var invalid = new RecipeRequest("Новый суп", "Описание рецепта достаточно подробное",
            "Космическая", "🍜", "", 30, 2, "Легко", List.of("Вода"), List.of("Сварить"), List.of());
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.create(invalid, 1L));
    }

    @Test void favoritesCanBeToggledAndAreUserSpecific() {
        assertTrue(service.toggleFavorite(1, 1L));
        assertTrue(service.favorites(1L).stream().anyMatch(r -> r.id() == 1));
        assertFalse(service.toggleFavorite(1, 1L));
        assertFalse(service.favorites(1L).stream().anyMatch(r -> r.id() == 1));
        assertTrue(service.favorites(2L).stream().anyMatch(r -> r.id() == 1));
    }

    @Test void onlyPublishedRecipesCanBeFavoritedOrReviewed() {
        var created = service.create(request("Ожидающий суп"), 1L);
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.toggleFavorite(created.id(), 1L));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.review(created.id(), new ReviewRequest(5, "Отлично"), 1L));
    }

    @Test void reviewCanBeAddedOnlyOncePerUser() {
        var created = service.review(1, new ReviewRequest(4, "Очень вкусно"), 1L);
        assertEquals(4, created.rating());
        assertTrue(service.reviews(1).stream().anyMatch(r -> r.id() == created.id()));
        assertStatus(HttpStatus.CONFLICT, () -> service.review(1, new ReviewRequest(5, "Отлично"), 1L));
    }

    @Test void onlyModeratorCanApproveOrReject() {
        var pending = service.create(request("Проверяемый суп"), 1L);
        assertStatus(HttpStatus.FORBIDDEN, () -> service.moderate(pending.id(), "APPROVED", 1L));
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.moderate(pending.id(), "INVALID", 3L));
        assertEquals("APPROVED", service.moderate(pending.id(), "APPROVED", 3L).status());
        assertStatus(HttpStatus.CONFLICT, () -> service.moderate(pending.id(), "REJECTED", 3L));
    }

    @Test void rejectedRecipeIsNotPublic() {
        var pending = service.create(request("Отклонённый суп"), 1L);
        service.moderate(pending.id(), "REJECTED", 3L);
        assertStatus(HttpStatus.NOT_FOUND, () -> service.get(pending.id(), null));
        assertEquals("REJECTED", service.get(pending.id(), 1L).status());
    }

    @Test void moderatorCanReadPendingList() {
        assertTrue(service.pending(3L).size() > 0);
        assertStatus(HttpStatus.FORBIDDEN, () -> service.pending(2L));
    }
}
