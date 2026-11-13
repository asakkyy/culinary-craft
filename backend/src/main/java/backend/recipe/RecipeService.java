package backend.recipe;

import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

@Service
public class RecipeService {

    private final AtomicLong nextId = new AtomicLong(4);
    private final List<Recipe> recipes = new CopyOnWriteArrayList<>(List.of(
            new Recipe(1, "Сырники", "Завтрак", 25),
            new Recipe(2, "Паста с томатами", "Ужин", 30),
            new Recipe(3, "Овощной салат", "Обед", 15)
    ));

    public List<Recipe> findAll(String query, String category) {
        String searchText = normalize(query);
        String searchCategory = normalize(category);
        return recipes.stream()
                .filter(recipe -> normalize(recipe.title()).contains(searchText))
                .filter(recipe -> searchCategory.isEmpty()
                        || normalize(recipe.category()).equals(searchCategory))
                .toList();
    }

    public Recipe findById(long id) {
        return recipes.stream()
                .filter(recipe -> recipe.id() == id)
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Рецепт не найден: " + id));
    }

    public Recipe create(CreateRecipeRequest request) {
        if (request == null || request.title() == null || request.title().isBlank()) {
            throw new IllegalArgumentException("Название рецепта обязательно");
        }
        if (request.category() == null || request.category().isBlank()) {
            throw new IllegalArgumentException("Категория обязательна");
        }
        if (request.minutes() <= 0 || request.minutes() > 1440) {
            throw new IllegalArgumentException("Время должно быть от 1 до 1440 минут");
        }
        Recipe recipe = new Recipe(nextId.getAndIncrement(),
                request.title().trim(), request.category().trim(), request.minutes());
        recipes.add(recipe);
        return recipe;
    }

    private static String normalize(String text) {
        return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
    }
}
