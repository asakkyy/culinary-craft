package com.culinarycraft.service;

import static org.junit.jupiter.api.Assertions.*;

import com.culinarycraft.model.RecipeRequest;
import com.culinarycraft.PostgresIntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

class RecipeServiceTest extends PostgresIntegrationTest {
    @Autowired private RecipeService service;


    @Test
    void guestCanBrowseApprovedRecipesOnly() {
        var page = service.catalog("", "Все рецепты", "newest", 0, 30, null);
        assertEquals(8, page.get("total"));
    }

    @Test
    void authorCreatesPendingRecipeAndModeratorApprovesIt() {
        var request = new RecipeRequest("Новый суп", "Очень вкусный домашний суп с овощами", "Супы",
            "🍜", "", 30, 2, "Легко", List.of("Вода", "Овощи"), List.of("Сварить"), List.of("Домашнее"));
        var created = service.create(request, 1L);
        assertEquals("PENDING", created.status());
        assertEquals(1, service.pending(3L).stream().filter(r -> r.id() == created.id()).count());
        var approved = service.moderate(created.id(), "APPROVED", 3L);
        assertEquals("APPROVED", approved.status());
        assertEquals(9, service.catalog("", "Все рецепты", "popular", 0, 30, null).get("total"));
    }

    @Test
    void otherUserCannotEditRecipe() {
        var request = new RecipeRequest("Новый суп", "Очень вкусный домашний суп с овощами", "Супы",
            "🍜", "", 30, 2, "Легко", List.of("Овощи"), List.of("Сварить"), List.of());
        assertThrows(ResponseStatusException.class, () -> service.update(1, request, 2L));
    }
}
