package backend.recipe;

import java.util.NoSuchElementException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecipeServiceTest {

    private RecipeService service;

    @BeforeEach
    void setUp() {
        service = new RecipeService();
    }

    @Test
    void returnsSeededRecipes() {
        assertEquals(3, service.findAll(null, null).size());
    }

    @Test
    void searchesByNameCaseInsensitively() {
        assertEquals("Сырники", service.findAll("  СЫР ", "").getFirst().title());
    }

    @Test
    void filtersByCategory() {
        assertEquals(1, service.findAll("", "УЖИН").size());
        assertEquals("Паста с томатами", service.findAll("", "УЖИН").getFirst().title());
    }

    @Test
    void combinesFiltersAndReturnsEmptyResults() {
        assertTrue(service.findAll("салат", "Завтрак").isEmpty());
        assertTrue(service.findAll("нет такого рецепта", "").isEmpty());
    }

    @Test
    void findsRecipeByIdentifier() {
        assertEquals("Овощной салат", service.findById(3).title());
    }

    @Test
    void rejectsUnknownIdentifier() {
        assertThrows(NoSuchElementException.class, () -> service.findById(1000));
    }

    @Test
    void createsNewRecipeAndMakesItSearchable() {
        Recipe created = service.create(new CreateRecipeRequest("  Оладьи  ", " Завтрак ", 20));
        assertEquals(4, created.id());
        assertEquals("Оладьи", created.title());
        assertEquals("Завтрак", created.category());
        assertEquals(created, service.findById(created.id()));
        assertFalse(service.findAll("оладьи", "").isEmpty());
    }

    @Test
    void validatesRequiredTitleAndCategory() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new CreateRecipeRequest("", "Обед", 20)));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new CreateRecipeRequest(null, "Обед", 20)));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new CreateRecipeRequest("Суп", " ", 20)));
        assertThrows(IllegalArgumentException.class, () -> service.create(null));
    }

    @Test
    void validatesDurationBoundaries() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new CreateRecipeRequest("Суп", "Обед", 0)));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(new CreateRecipeRequest("Суп", "Обед", 1441)));
        assertEquals(1440, service.create(new CreateRecipeRequest("Суп", "Обед", 1440)).minutes());
    }
}
