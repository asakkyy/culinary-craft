package com.culinarycraft.service;

import com.culinarycraft.model.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Прототипное хранилище. При перезапуске приложения данные возвращаются к исходным. */
@Service
public class RecipeService {
    private final DemoUserService users;
    private final Map<Long, Recipe> recipes = new ConcurrentHashMap<>();
    private final Map<Long, List<Review>> reviews = new ConcurrentHashMap<>();
    private final Map<Long, Set<Long>> favorites = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(100);
    private final AtomicLong reviewSequence = new AtomicLong(100);

    public RecipeService(DemoUserService users) {
        this.users = users;
        seed();
    }

    public Map<String, Object> catalog(String search, String category, String sort,
                                        int page, int size, Long userId) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(30, size));
        String text = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        List<Recipe> matching = recipes.values().stream()
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
        return recipes.values().stream().filter(r -> r.ownerId() == user.id())
            .sorted(Comparator.comparing(Recipe::createdAt).reversed())
            .map(r -> view(r, userId)).toList();
    }

    public List<RecipeView> favorites(Long userId) {
        DemoUser user = users.requireUser(userId);
        Set<Long> saved = favorites.getOrDefault(user.id(), Set.of());
        return recipes.values().stream().filter(r -> saved.contains(r.id()))
            .filter(r -> "APPROVED".equals(r.status()))
            .sorted(Comparator.comparing(Recipe::createdAt).reversed())
            .map(r -> view(r, userId)).toList();
    }

    public List<RecipeView> pending(Long userId) {
        users.requireAdmin(userId);
        return recipes.values().stream().filter(r -> "PENDING".equals(r.status()))
            .sorted(Comparator.comparing(Recipe::createdAt).reversed())
            .map(r -> view(r, userId)).toList();
    }

    public synchronized RecipeView create(RecipeRequest request, Long userId) {
        DemoUser user = users.requireUser(userId);
        validateCategory(request.category());
        long id = sequence.incrementAndGet();
        Recipe recipe = fromRequest(id, request, user, "PENDING", Instant.now());
        recipes.put(id, recipe);
        return view(recipe, userId);
    }

    public synchronized RecipeView update(long id, RecipeRequest request, Long userId) {
        DemoUser user = users.requireUser(userId);
        Recipe before = required(id);
        if (user.id() != before.ownerId() && !user.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Редактировать можно только свой рецепт");
        }
        validateCategory(request.category());
        DemoUser owner = users.requireUser(before.ownerId());
        Recipe changed = fromRequest(id, request, owner, "PENDING", before.createdAt());
        recipes.put(id, changed);
        return view(changed, userId);
    }

    public synchronized void delete(long id, Long userId) {
        DemoUser user = users.requireUser(userId);
        Recipe recipe = required(id);
        if (user.id() != recipe.ownerId() && !user.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Удалить можно только свой рецепт");
        }
        recipes.remove(id);
        reviews.remove(id);
        favorites.values().forEach(saved -> saved.remove(id));
    }

    public synchronized boolean toggleFavorite(long id, Long userId) {
        DemoUser user = users.requireUser(userId);
        if (!"APPROVED".equals(required(id).status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "В избранное добавляются только опубликованные рецепты");
        }
        Set<Long> saved = favorites.computeIfAbsent(user.id(), k -> ConcurrentHashMap.newKeySet());
        if (saved.contains(id)) {
            saved.remove(id);
            return false;
        }
        saved.add(id);
        return true;
    }

    public List<Review> reviews(long recipeId) {
        Recipe r = required(recipeId);
        if (!"APPROVED".equals(r.status())) {
            return List.of();
        }
        return List.copyOf(reviews.getOrDefault(recipeId, List.of()));
    }

    public synchronized Review review(long recipeId, ReviewRequest request, Long userId) {
        DemoUser user = users.requireUser(userId);
        Recipe recipe = required(recipeId);
        if (!"APPROVED".equals(recipe.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Нельзя оценивать неопубликованный рецепт");
        }
        List<Review> list = reviews.computeIfAbsent(recipeId, k -> new ArrayList<>());
        if (list.stream().anyMatch(r -> r.authorId() == user.id())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Вы уже оценивали этот рецепт");
        }
        Review review = new Review(reviewSequence.incrementAndGet(), recipeId, user.id(),
            user.name(), request.rating(), request.comment().strip(), Instant.now());
        list.add(0, review);
        return review;
    }

    public synchronized RecipeView moderate(long id, String status, Long userId) {
        users.requireAdmin(userId);
        if (!"APPROVED".equals(status) && !"REJECTED".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Допустимые статусы: APPROVED и REJECTED");
        }
        Recipe r = required(id);
        if (!"PENDING".equals(r.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "На модерации может находиться только ожидающий рецепт");
        }
        Recipe changed = new Recipe(r.id(), r.title(), r.description(), r.category(), r.emoji(),
            r.imageUrl(), r.prepMinutes(), r.servings(), r.difficulty(), r.ingredients(),
            r.steps(), r.tags(), r.ownerId(), r.ownerName(), status, r.createdAt());
        recipes.put(id, changed);
        return view(changed, userId);
    }

    private Recipe required(long id) {
        Recipe recipe = recipes.get(id);
        if (recipe == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Рецепт не найден");
        }
        return recipe;
    }

    private void validateCategory(String category) {
        if (!List.of("Завтраки", "Основные блюда", "Десерты", "Салаты", "Супы", "Напитки").contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная категория рецепта");
        }
    }

    private Recipe fromRequest(long id, RecipeRequest request, DemoUser user, String status, Instant createdAt) {
        return new Recipe(id, request.title().strip(), request.description().strip(), request.category(),
            request.emoji() == null || request.emoji().isBlank() ? "🍽️" : request.emoji(),
            request.imageUrl() == null ? "" : request.imageUrl().strip(), request.prepMinutes(),
            request.servings(), request.difficulty(), List.copyOf(request.ingredients()),
            List.copyOf(request.steps()), request.tags() == null ? List.of() : List.copyOf(request.tags()),
            user.id(), user.name(), status, createdAt);
    }

    private RecipeView view(Recipe r, Long userId) {
        List<Review> list = reviews.getOrDefault(r.id(), List.of());
        return new RecipeView(r.id(), r.title(), r.description(), r.category(), r.emoji(), r.imageUrl(),
            r.prepMinutes(), r.servings(), r.difficulty(), r.ingredients(), r.steps(), r.tags(),
            r.ownerId(), r.ownerName(), r.status(), r.createdAt(), average(r), list.size(),
            userId != null && favorites.getOrDefault(userId, Set.of()).contains(r.id()));
    }

    private double average(Recipe r) {
        List<Review> list = reviews.getOrDefault(r.id(), List.of());
        if (list.isEmpty()) return 0;
        double mean = list.stream().mapToInt(Review::rating).average().orElse(0);
        return Math.round(mean * 10.0) / 10.0;
    }

    private Recipe sample(long id, String title, String description, String category, String emoji,
                          String image, int minutes, int portions, String difficulty,
                          long authorId, String status, String ingredients, String steps, String tags) {
        DemoUser user = users.requireUser(authorId);
        return new Recipe(id, title, description, category, emoji, image, minutes, portions, difficulty,
            List.of(ingredients.split("\\|")), List.of(steps.split("\\|")), List.of(tags.split("\\|")),
            user.id(), user.name(), status, Instant.now().minusSeconds((11 - id) * 86400L));
    }

    private void add(Recipe r) { recipes.put(r.id(), r); }

    private void seedReview(long recipeId, long authorId, int stars, String message) {
        DemoUser user = users.requireUser(authorId);
        reviews.computeIfAbsent(recipeId, k -> new ArrayList<>())
            .add(new Review(reviewSequence.incrementAndGet(), recipeId, authorId, user.name(),
                stars, message, Instant.now().minusSeconds(86400)));
    }

    private void seed() {
        add(sample(1, "Панкейки с ягодами и мёдом", "Воздушные, золотистые панкейки с сезонными ягодами — идеальное начало неспешного утра.",
            "Завтраки", "🥞", "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=900&q=85", 25, 2, "Легко", 1, "APPROVED",
            "Мука — 180 г|Молоко — 200 мл|Яйцо — 1 шт.|Разрыхлитель — 1 ч. л.|Мёд и ягоды — по вкусу",
            "Смешайте сухие ингредиенты.|Добавьте молоко и яйцо, перемешайте до однородности.|Жарьте небольшими порциями на сухой сковороде по 2 минуты с каждой стороны.|Подавайте с ягодами и мёдом.", "Быстро|Для семьи|Сладкое"));
        add(sample(2, "Паста с томатами и базиликом", "Итальянская классика: сочные томаты, ароматный базилик и нежный пармезан.",
            "Основные блюда", "🍝", "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=900&q=85", 35, 3, "Легко", 2, "APPROVED",
            "Паста — 300 г|Томаты черри — 250 г|Чеснок — 2 зубчика|Базилик — 1 пучок|Пармезан — 40 г",
            "Отварите пасту до al dente.|Обжарьте чеснок и томаты на оливковом масле.|Добавьте пасту и немного воды от варки.|Перемешайте с базиликом и посыпьте пармезаном.", "Италия|Вегетарианское|На ужин"));
        add(sample(3, "Шоколадный брауни", "Насыщенный шоколадный десерт с тонкой хрустящей корочкой и влажной серединкой.",
            "Десерты", "🍫", "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=900&q=85", 45, 6, "Средне", 1, "APPROVED",
            "Тёмный шоколад — 180 г|Сливочное масло — 120 г|Сахар — 140 г|Яйца — 3 шт.|Мука — 90 г",
            "Растопите шоколад с маслом.|Вмешайте сахар и яйца.|Добавьте муку и перемешайте.|Выпекайте 25 минут при 175 °C, затем остудите.", "Шоколад|Выпечка|К чаю"));
        add(sample(4, "Греческий салат", "Хрустящие овощи, фета, оливки и оливковое масло — вкус Средиземноморья.",
            "Салаты", "🥗", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=85", 15, 2, "Легко", 2, "APPROVED",
            "Огурцы — 2 шт.|Помидоры — 3 шт.|Сладкий перец — 1 шт.|Фета — 120 г|Оливки — 70 г",
            "Крупно нарежьте овощи.|Добавьте сыр фета и оливки.|Полейте оливковым маслом и посыпьте орегано.", "Свежие овощи|Без духовки|Быстро"));
        add(sample(5, "Тыквенный крем-суп", "Бархатистый согревающий суп с нотками имбиря и хрустящими семечками.",
            "Супы", "🥣", "https://images.unsplash.com/photo-1547592180-85f173990554?w=900&q=85", 40, 4, "Легко", 1, "APPROVED",
            "Тыква — 700 г|Морковь — 1 шт.|Лук — 1 шт.|Сливки — 100 мл|Имбирь — 10 г",
            "Обжарьте лук и морковь.|Добавьте тыкву и воду, варите 25 минут.|Пюрируйте блендером, влейте сливки и прогрейте.|Подавайте с семечками.", "Осень|Согревающее|Овощи"));
        add(sample(6, "Смузи с клубникой и бананом", "Освежающий ягодный напиток без лишнего сахара, готовится за пять минут.",
            "Напитки", "🍓", "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=900&q=85", 5, 2, "Легко", 2, "APPROVED",
            "Клубника — 200 г|Банан — 1 шт.|Йогурт — 200 мл|Молоко — 100 мл",
            "Очистите банан и промойте ягоды.|Сложите ингредиенты в блендер.|Взбейте до однородности и сразу подавайте.", "Без сахара|Быстро|Полезное"));
        add(sample(7, "Домашняя пицца Маргарита", "Тонкое тесто, спелые томаты и тягучая моцарелла — ничего лишнего.",
            "Основные блюда", "🍕", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=900&q=85", 70, 4, "Средне", 1, "APPROVED",
            "Тесто для пиццы — 350 г|Томатный соус — 100 г|Моцарелла — 180 г|Базилик — 1 пучок",
            "Разогрейте духовку до 240 °C.|Растяните тесто и распределите соус.|Выложите сыр и выпекайте 10–12 минут.|Украсьте базиликом.", "Италия|Для семьи|В духовке"));
        add(sample(8, "Овсянка с яблоками и корицей", "Нежная каша с карамелизированными яблоками, орехами и тёплой корицей.",
            "Завтраки", "🍎", "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=900&q=85", 20, 2, "Легко", 2, "APPROVED",
            "Овсяные хлопья — 100 г|Молоко — 250 мл|Яблоко — 1 шт.|Корица — 1/2 ч. л.|Грецкие орехи — 30 г",
            "Сварите овсянку на молоке.|Нарежьте яблоко и прогрейте на сковороде с корицей.|Украсьте кашу яблоками и орехами.", "Без мяса|Завтрак|Уютно"));
        add(sample(9, "Лимонные сырники", "Румяные сырники с цедрой лимона и нежным творожным вкусом.",
            "Завтраки", "🍋", "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=900&q=85", 30, 3, "Легко", 1, "PENDING",
            "Творог — 400 г|Яйцо — 1 шт.|Мука — 4 ст. л.|Лимонная цедра — 1 ч. л.",
            "Смешайте все ингредиенты.|Сформируйте сырники и обваляйте в муке.|Обжарьте до золотистой корочки.", "Творог|Завтрак"));
        add(sample(10, "Домашний лимонад", "Лёгкий цитрусовый напиток с мятой и льдом для жаркого дня.",
            "Напитки", "🍋", "https://images.unsplash.com/photo-1513558161293-cdaf765edfd4?w=900&q=85", 10, 4, "Легко", 2, "PENDING",
            "Лимон — 2 шт.|Вода — 800 мл|Мята — 4 веточки|Мёд — по вкусу",
            "Выжмите сок лимонов.|Смешайте с водой и мёдом.|Добавьте мяту и лёд.", "Лето|Напитки"));
        seedReview(1, 2, 5, "Получились невероятно воздушными, спасибо!");
        seedReview(2, 1, 5, "Очень вкусно и действительно просто готовить.");
        seedReview(3, 2, 4, "Всем понравилось, в следующий раз добавлю орехи.");
        seedReview(4, 1, 5, "Классика, всегда получается вкусно.");
        seedReview(5, 2, 4, "Нежный и ароматный суп.");
        favorites.put(1L, ConcurrentHashMap.newKeySet());
        favorites.get(1L).addAll(List.of(2L, 4L, 6L));
        favorites.put(2L, ConcurrentHashMap.newKeySet());
        favorites.get(2L).addAll(List.of(1L, 3L));
    }
}
