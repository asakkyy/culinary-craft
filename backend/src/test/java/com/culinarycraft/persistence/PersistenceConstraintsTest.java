package com.culinarycraft.persistence;

import static org.junit.jupiter.api.Assertions.*;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.model.RecipeRequest;
import com.culinarycraft.model.ReviewRequest;
import com.culinarycraft.service.RecipeService;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Committed transactions: database constraints and simultaneous HTTP-equivalent service calls. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresIntegrationTest.Database.class)
class PersistenceConstraintsTest {
    @Autowired RecipeService service;
    @Autowired JdbcTemplate jdbc;

    private long recipe() {
        var request = new RecipeRequest("Проверка транзакций", "Подробное описание проверки транзакций",
            "Супы", "🍜", "", 30, 2, "Легко", List.of("Вода"), List.of("Сварить"), List.of());
        long id = service.create(request, 1L).id();
        service.moderate(id, "APPROVED", 3L);
        return id;
    }

    @Test
    void databaseRejectsDuplicateReviewsFavoritesAndMissingUsers() {
        long id = recipe();
        try {
            service.review(id, new ReviewRequest(5, "Вкусный суп"), 2L);
            service.toggleFavorite(id, 1L);
            assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "insert into reviews(recipe_id, author_id, rating, comment, created_at) values (?, 2, 4, 'duplicate', now())", id));
            assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "insert into favorites(user_id, recipe_id) values (1, ?)", id));
            assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "insert into favorites(user_id, recipe_id) values (999, ?)", id));
        } finally {
            service.delete(id, 1L);
        }
    }

    @Test
    void concurrentReviewsReturnConflictAndFavoriteTogglesAreSerialized() throws Exception {
        long id = recipe();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Integer> review = () -> {
                start.await();
                try {
                    service.review(id, new ReviewRequest(5, "Одновременный отзыв"), 2L);
                    return 200;
                } catch (ResponseStatusException error) {
                    return error.getStatusCode().value();
                }
            };
            Future<Integer> first = executor.submit(review);
            Future<Integer> second = executor.submit(review);
            start.countDown();
            assertEquals(List.of(200, 409), List.of(first.get(20, TimeUnit.SECONDS),
                second.get(20, TimeUnit.SECONDS)).stream().sorted().toList());
            assertEquals(1, service.reviews(id).size());
            assertEquals(5.0, service.get(id, null).rating());

            CountDownLatch toggleStart = new CountDownLatch(1);
            Callable<Boolean> toggle = () -> { toggleStart.await(); return service.toggleFavorite(id, 1L); };
            Future<Boolean> a = executor.submit(toggle);
            Future<Boolean> b = executor.submit(toggle);
            toggleStart.countDown();
            assertNotEquals(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
            assertFalse(service.get(id, 1L).favorite());
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(20, TimeUnit.SECONDS));
            service.delete(id, 1L);
        }
    }
}
