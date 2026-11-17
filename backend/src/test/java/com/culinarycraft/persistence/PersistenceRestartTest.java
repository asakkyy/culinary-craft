package com.culinarycraft.persistence;

import static org.junit.jupiter.api.Assertions.*;

import com.culinarycraft.CulinaryCraftApplication;
import com.culinarycraft.model.RecipeRequest;
import com.culinarycraft.model.ReviewRequest;
import com.culinarycraft.service.RecipeService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class PersistenceRestartTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    private ConfigurableApplicationContext start() {
        return new SpringApplicationBuilder(CulinaryCraftApplication.class)
            .web(WebApplicationType.NONE).run(
                "--spring.datasource.url=" + postgres.getJdbcUrl(),
                "--spring.datasource.username=" + postgres.getUsername(),
                "--spring.datasource.password=" + postgres.getPassword());
    }

    @Test
    void recipesReviewsFavoritesAndDeletionsSurviveApplicationRestart() {
        long id;
        long mediaOwner;
        java.util.UUID photoId;
        byte[] photoBytes;
        try (var first = start()) {
            RecipeService service = first.getBean(RecipeService.class);
            var request = new RecipeRequest("Суп после перезапуска", "Подробное описание сохраняемого супа",
                "Супы", "🍜", "", 35, 3, "Легко", List.of("Вода", "Морковь", "Соль"),
                List.of("Нарезать", "Сварить", "Подать"), List.of("Домашнее", "Быстро"));
            id = service.create(request, 1L).id();
            service.moderate(id, "APPROVED", 3L);
            service.review(id, new ReviewRequest(5, "Отличный вкус"), 2L);
            service.review(id, new ReviewRequest(4, "Приготовлю снова"), 1L);
            assertTrue(service.toggleFavorite(id, 1L));
            service.update(id, request, 1L);
            service.moderate(id, "APPROVED", 3L);
            service.delete(8, 2L);
            var accounts = first.getBean(com.culinarycraft.auth.AccountService.class);
            mediaOwner = accounts.register(new com.culinarycraft.auth.AccountService.Registration(
                "Media owner", "media-restart@example.test", "Long media password 123")).id();
            long mediaRecipe = service.create(request, mediaOwner).id();
            var output = new java.io.ByteArrayOutputStream();
            try {
                javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(3, 2, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", output);
            } catch (java.io.IOException error) { throw new IllegalStateException(error); }
            var upload = new org.springframework.mock.web.MockMultipartFile("file", "cover.png", "image/png", output.toByteArray());
            var media = first.getBean(com.culinarycraft.media.MediaService.class);
            photoId = media.photo(mediaRecipe, mediaOwner, upload).id();
            media.avatar(mediaOwner, upload);
            photoBytes = media.read(photoId, mediaOwner);
        }
        // A completely new Spring context and connection pool use the same database.
        try (var second = start()) {
            assertArrayEquals(photoBytes, second.getBean(com.culinarycraft.media.MediaService.class).read(photoId, mediaOwner));
            assertNotNull(second.getBean(com.culinarycraft.auth.AccountService.class).me(mediaOwner).avatarUrl());
            RecipeService service = second.getBean(RecipeService.class);
            var recipe = service.get(id, 1L);
            assertEquals("Суп после перезапуска", recipe.title());
            assertEquals(List.of("Вода", "Морковь", "Соль"), recipe.ingredients());
            assertEquals(List.of("Нарезать", "Сварить", "Подать"), recipe.steps());
            assertEquals(List.of("Домашнее", "Быстро"), recipe.tags());
            assertEquals("APPROVED", recipe.status());
            assertEquals(4.5, recipe.rating());
            assertEquals(2, recipe.reviewCount());
            assertEquals(2, service.reviews(id).size());
            assertTrue(recipe.favorite());
            assertTrue(service.favorites(1L).stream().anyMatch(r -> r.id() == id));
            assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.get(8, 2L));
            assertEquals(8, service.catalog("", "Все рецепты", "newest", 0, 30, null).get("total"));
            var jdbc = second.getBean(JdbcTemplate.class);
            assertEquals(5, jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success", Integer.class));
            service.delete(id, 1L);
            assertEquals(0, jdbc.queryForObject("select count(*) from reviews where recipe_id = ?", Integer.class, id));
            assertEquals(0, jdbc.queryForObject("select count(*) from favorites where recipe_id = ?", Integer.class, id));
            assertEquals(0, jdbc.queryForObject("select count(*) from recipe_steps where recipe_id = ?", Integer.class, id));
        }
    }
}
