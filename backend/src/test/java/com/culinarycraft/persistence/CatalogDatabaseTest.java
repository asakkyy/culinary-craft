package com.culinarycraft.persistence;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.model.*;
import com.culinarycraft.service.RecipeService;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class CatalogDatabaseTest extends PostgresIntegrationTest {
    @Autowired RecipeService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entities;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    private final String prefix = "catalog" + UUID.randomUUID();
    @BeforeEach void fixtures() {
        jdbc.update("""
            insert into recipes(title,description,category,emoji,image_url,prep_minutes,servings,difficulty,owner_id,status,created_at)
            select ? || ' запись ' || n, 'Подробное описание 100%_match для поиска', 'Супы', '', '', n % 7 + 1, 2, 'Легко', 1,
              case when n <= 60 then 'APPROVED' else 'PENDING' end, timestamptz '2026-01-01 00:00:00Z'
            from generate_series(1,65) n
            """, prefix);
        jdbc.update("insert into recipe_tags select id,0,'Alpha' from recipes where title like ?", prefix + "%");
        jdbc.update("insert into recipe_tags select id,1,'Beta' from recipes where title like ?", prefix + "%");
        jdbc.update("insert into recipe_ingredients select id,0,'Вода' from recipes where title like ?", prefix + "%");
        jdbc.update("insert into recipe_steps select id,0,'Сварить' from recipes where title like ?", prefix + "%");
        jdbc.update("insert into reviews(recipe_id,author_id,rating,comment,created_at) select id,1,5,'Вкусно',current_timestamp from recipes where title like ?", prefix + "%");
        jdbc.update("insert into reviews(recipe_id,author_id,rating,comment,created_at) select id,2,3,'Хорошо',current_timestamp from recipes where title like ?", prefix + "%");
    }
    @SuppressWarnings("unchecked") private List<RecipeView> content(Map<String, Object> page) { return (List<RecipeView>) page.get("content"); }
    @Test void sqlPaginationLoadsOnlyPageDetailsWithoutNPlusOne() {
        entities.clear();
        var stats = entities.getEntityManagerFactory().unwrap(org.hibernate.SessionFactory.class).getStatistics(); stats.clear();
        var result = service.catalog(prefix, "супы", "newest", 0, 30, 1L);
        assertEquals(60, result.get("total")); assertEquals(2, result.get("totalPages")); assertEquals(30, content(result).size());
        assertTrue(stats.getPrepareStatementCount() <= 6, "Page details must use bounded batch queries, observed " + stats.getPrepareStatementCount());
        assertTrue(stats.getEntityLoadCount() <= 35, "Must not hydrate the complete catalog");
        var recipe = content(result).get(0); assertEquals(4.0, recipe.rating()); assertEquals(2, recipe.reviewCount());
        assertEquals(List.of("Alpha", "Beta"), recipe.tags()); assertEquals(List.of("Вода"), recipe.ingredients());
        jdbc.update("insert into favorites(user_id,recipe_id) values (1,?)", recipe.id());
        assertTrue(content(service.catalog(prefix, "", "newest", 0, 1, 1L)).get(0).favorite());
    }
    @Test void searchPreservesLiteralCharactersTagPhrasesAndReindexesEdits() {
        assertEquals(60, service.catalog("100%_match", "", "newest", 0, 6, null).get("total"));
        assertEquals(60, service.catalog("alpha beta", "", "newest", 0, 6, null).get("total"));
        assertEquals(0, service.catalog("100_anything", "", "newest", 0, 6, null).get("total"));
        assertEquals(0, service.catalog("%' OR 1=1 --", "", "newest", 0, 6, null).get("total"));
        long id = content(service.catalog(prefix, "", "newest", 0, 1, null)).get(0).id();
        var input = new RecipeRequest("Обновлённый индексируемый суп", "Новое подробное описание рецепта", "Супы", "", "", 12, 2,
            "Легко", List.of("Морковь"), List.of("Варить"), List.of("Gamma", "Delta"));
        service.update(id, input, 1L);
        assertEquals(0, service.catalog("gamma delta", "", "newest", 0, 6, null).get("total"));
        service.moderate(id, "APPROVED", 3L);
        assertEquals(1, service.catalog("gamma delta", "", "newest", 0, 6, null).get("total"));
        assertEquals(59, service.catalog("alpha beta", "", "newest", 0, 6, null).get("total"));
    }
    @Test void allSortsHaveDeterministicTiesAndRespectPageBounds() {
        for (String sort : List.of("newest", "quick", "rating", "popular")) {
            var first = content(service.catalog(prefix, "", sort, 0, 6, null)).stream().map(RecipeView::id).toList();
            var second = content(service.catalog(prefix, "", sort, 1, 6, null)).stream().map(RecipeView::id).toList();
            assertTrue(Collections.disjoint(first, second));
            assertEquals(first, content(service.catalog(prefix, "", sort, 0, 6, null)).stream().map(RecipeView::id).toList());
        }
        assertEquals(0, content(service.catalog(prefix, "", "newest", Integer.MAX_VALUE, 30, null)).size());
        assertEquals(0, service.catalog(prefix, "", "newest", -1, 0, null).get("page"));
        assertEquals(1, service.catalog(prefix, "", "newest", -1, 0, null).get("size"));
    }
    @Test @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void snapshotIsConsistentDuringAConcurrentCommit() throws Exception {
        try {
            var snapshot = new org.springframework.transaction.support.TransactionTemplate(transactions);
            snapshot.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);
            snapshot.executeWithoutResult(status -> {
                assertEquals(60, service.catalog(prefix, "", "newest", 0, 6, null).get("total"));
                try {
                    java.util.concurrent.CompletableFuture.runAsync(() -> jdbc.update("""
                        insert into recipes(title,description,category,emoji,image_url,prep_minutes,servings,difficulty,owner_id,status,created_at)
                        values (?, 'Параллельная опубликованная запись', 'Супы', '', '', 15, 2, 'Легко', 1, 'APPROVED', current_timestamp)
                        """, prefix + " concurrent")).get(10, java.util.concurrent.TimeUnit.SECONDS);
                } catch (Exception error) { throw new IllegalStateException(error); }
                assertEquals(60, service.catalog(prefix, "", "newest", 0, 6, null).get("total"));
            });
            assertEquals(61, service.catalog(prefix, "", "newest", 0, 6, null).get("total"));
        } finally { jdbc.update("delete from recipes where title like ?", prefix + "%"); }
    }
}
