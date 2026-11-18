package com.culinarycraft.admin;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.auth.*;
import com.culinarycraft.persistence.*;
import com.culinarycraft.model.RecipeRequest;
import com.culinarycraft.service.RecipeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.mockito.Mockito.doThrow;

class AdministrationApiTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DemoUserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired TokenService tokens;
    @Autowired AdministrationService service;
    @Autowired RecipeService recipes;
    @MockitoSpyBean AuditService events;
    @Autowired AuditRepository audit;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final String password = "Test admin password 123";
    private DemoUserEntity create(String email, String role) {
        var user = DemoUserEntity.account("Author " + email, email, passwords.encode(password), role);
        user.verifyEmail(); return users.saveAndFlush(user);
    }
    private Cookie cookie(DemoUserEntity user) { return new Cookie("cc-session", tokens.issue(user)); }
    private String report() throws Exception { return json.writeValueAsString(Map.of("reason", "SPAM", "description", "Подробная причина жалобы на рецепт")); }
    @Test void resolvingReportCanUnpublishRecipeInTheSameDecision() throws Exception {
        var reporter = create("unpublish-reporter@example.test", "USER");
        var admin = create("unpublish-reviewer@example.test", "ADMIN");
        long id = service.report(reporter.getId(), 1, new AdministrationService.ReportInput(RecipeReport.Reason.SPAM, "")).id();
        String path = "/api/admin/reports/" + id + "/decision";
        String body = "{\"status\":\"RESOLVED\",\"comment\":\"Нарушение подтверждено\",\"unpublishRecipe\":true}";
        long before = audit.count();
        mvc.perform(post(path).cookie(cookie(reporter)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isForbidden());
        mvc.perform(post(path).cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RESOLVED"))
            .andExpect(jsonPath("$.moderatorComment").value("Нарушение подтверждено"));
        mvc.perform(get("/api/recipes/1")).andExpect(status().isNotFound());
        mvc.perform(get("/api/recipes/1").cookie(cookie(admin))).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(post(path).cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict());
        assertEquals(before + 2, audit.count());
        mvc.perform(get("/api/admin/audit").cookie(cookie(admin)).param("action", "RECIPE_UNPUBLISHED"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }
    @ParameterizedTest
    @EnumSource(value = RecipeReport.Status.class, names = {"RESOLVED", "REJECTED"})
    void otherDecisionsLeavePublicationUntouched(RecipeReport.Status decision) throws Exception {
        var reporter = create("keep-reporter@example.test", "USER");
        var admin = create("keep-reviewer@example.test", "ADMIN");
        long id = service.report(reporter.getId(), 1, new AdministrationService.ReportInput(RecipeReport.Reason.SPAM, "")).id();
        long before = audit.count();
        String path = "/api/admin/reports/" + id + "/decision";
        mvc.perform(post(path).cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("status", decision, "comment", "Рецепт оставлен без изменений"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(decision.name()))
            .andExpect(jsonPath("$.moderatorComment").value("Рецепт оставлен без изменений"));
        mvc.perform(get("/api/recipes/1")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        assertEquals(before + 1, audit.count());
    }
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void unavailableRecipeLeavesReportOpen(boolean deleted) throws Exception {
        var reporter = create("unavailable-reporter@example.test", "USER");
        var admin = create("unavailable-reviewer@example.test", "ADMIN");
        long id = service.report(reporter.getId(), 1, new AdministrationService.ReportInput(RecipeReport.Reason.SPAM, "")).id();
        if (deleted) recipes.delete(1, admin.getId());
        else recipes.unpublish(1, admin.getId(), "Уже снят с публикации");
        long before = audit.count();
        mvc.perform(post("/api/admin/reports/" + id + "/decision").cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"RESOLVED\",\"comment\":\"Нарушение подтверждено\",\"unpublishRecipe\":true}"))
            .andExpect(status().is(deleted ? 404 : 409));
        assertEquals(RecipeReport.Status.OPEN, service.mineOne(reporter.getId(), id).status());
        assertEquals(before, audit.count());
    }
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void auditFailureRollsBackBothChangesAndRecipeAudit() {
        var reporter = create("rollback-reporter@example.test", "USER");
        var admin = create("rollback-reviewer@example.test", "ADMIN");
        var request = new RecipeRequest("Рецепт для отката", "Описание рецепта для проверки отката", "Супы", "", "",
            30, 2, "Легко", List.of("Вода"), List.of("Нагреть воду"), List.of());
        long recipe = recipes.create(request, admin.getId()).id();
        try {
            recipes.moderate(recipe, "APPROVED", admin.getId());
            long report = service.report(reporter.getId(), recipe, new AdministrationService.ReportInput(RecipeReport.Reason.SPAM, "")).id();
            long before = audit.count();
            doThrow(new IllegalStateException("Audit write failed")).when(events)
                .record(admin.getId(), AuditEvent.Action.REPORT_RESOLVED, "REPORT", report, "Status: RESOLVED");
            var decision = new AdministrationService.Decision(RecipeReport.Status.RESOLVED, "Причина снятия", true);
            assertThrows(IllegalStateException.class, () -> service.decide(admin.getId(), report, decision));
            assertEquals("APPROVED", recipes.get(recipe, null).status());
            var unchanged = service.mineOne(reporter.getId(), report);
            assertEquals(RecipeReport.Status.OPEN, unchanged.status());
            assertNull(unchanged.moderatorId());
            assertEquals(before, audit.count());
        } finally {
            jdbc.update("delete from recipe_reports where recipe_id = ?", recipe);
            jdbc.update("delete from administrative_audit where admin_id = ?", admin.getId());
            recipes.delete(recipe, admin.getId());
            users.deleteAll(List.of(reporter, admin));
        }
    }
    @Test void reportsArePrivateAndDecisionsAreAudited() throws Exception {
        long before = audit.count();
        var owner = create("reporter@example.test", "USER"); var other = create("other@example.test", "USER");
        var admin = create("admin@example.test", "ADMIN"); var second = create("second@example.test", "ADMIN");
        var response = mvc.perform(post("/api/recipes/1/reports").cookie(cookie(owner)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(report())).andExpect(status().isCreated()).andReturn();
        long id = json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/api/recipes/1/reports").cookie(cookie(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(report()))
            .andExpect(status().isConflict());
        mvc.perform(get("/api/reports/" + id).cookie(cookie(other))).andExpect(status().isNotFound());
        mvc.perform(get("/api/reports")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/reports").cookie(cookie(owner))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/reports").cookie(cookie(admin)).param("search", "reporter").param("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.size").value(1));
        service.decide(admin.getId(), id, new AdministrationService.Decision(RecipeReport.Status.IN_REVIEW, "Изучаем жалобу"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.decide(second.getId(), id,
            new AdministrationService.Decision(RecipeReport.Status.RESOLVED, "Чужое решение")));
        mvc.perform(post("/api/admin/reports/" + id + "/decision").cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"RESOLVED\",\"comment\":\"Внутренний комментарий администратора\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RESOLVED"));
        mvc.perform(get("/api/reports/" + id).cookie(cookie(owner))).andExpect(status().isOk())
            .andExpect(jsonPath("$.moderatorComment").isEmpty());
        assertEquals(before + 2, audit.count());
        mvc.perform(get("/api/admin/audit").cookie(cookie(admin)).param("action", "REPORT_RESOLVED"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }
    @Test void blockingRevokesOldJwtAndUnblockingRequiresNewLogin() throws Exception {
        long before = audit.count();
        var admin = create("admin@example.test", "ADMIN"); var owner = create("blocked@example.test", "USER");
        var session = cookie(owner);
        mvc.perform(post("/api/admin/users/" + owner.getId() + "/block").cookie(cookie(admin)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Нарушение правил сообщества\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("BLOCKED"));
        mvc.perform(get("/api/recipes/mine").cookie(session)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", owner.getEmail(), "password", password)))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/recipes/1")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/users/" + owner.getId() + "/unblock").cookie(cookie(admin)).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/recipes/mine").cookie(session)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", owner.getEmail(), "password", password)))).andExpect(status().isOk());
        assertEquals(before + 2, audit.count());
        mvc.perform(post("/api/admin/users/" + admin.getId() + "/block").cookie(cookie(admin)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Самоблокировка\"}")).andExpect(status().isConflict());
    }
    @Test void rateLimitPaginationAndValidationAreEnforcedInDatabaseQueries() throws Exception {
        var owner = create("reporter@example.test", "USER"); var admin = create("admin@example.test", "ADMIN");
        for (var reason : RecipeReport.Reason.values()) service.report(owner.getId(), 1, new AdministrationService.ReportInput(reason, "Подробное описание проблемы"));
        mvc.perform(post("/api/recipes/2/reports").cookie(cookie(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(report()))
            .andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/reports").cookie(cookie(owner)).param("page", "1").param("size", "2"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(5)).andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.content.length()").value(2));
        mvc.perform(get("/api/admin/users").cookie(cookie(admin)).param("search", "REPORTER").param("status", "ACTIVE").param("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        mvc.perform(post("/api/recipes/9/reports").cookie(cookie(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(report()))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/recipes/1/reports").cookie(cookie(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"INVALID\",\"description\":\"invalid reason\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/users").cookie(cookie(owner))).andExpect(status().isForbidden());
    }
    @Test void optionalDescriptionAndAdministrativeSortingStayServerSide() throws Exception {
        var owner = create("sorter@example.test", "USER"); var admin = create("admin-sort@example.test", "ADMIN");
        mvc.perform(post("/api/recipes/1/reports").cookie(cookie(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"SPAM\"}")).andExpect(status().isCreated());
        mvc.perform(get("/api/admin/reports").cookie(cookie(admin)).param("sort", "createdAt,asc").param("size", "10"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/api/admin/users").cookie(cookie(admin)).param("role", "USER").param("status", "ACTIVE")
            .param("sort", "name,asc").param("size", "1")).andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.content[0].email").value(owner.getEmail()));
        mvc.perform(get("/api/admin/users").cookie(cookie(admin)).param("sort", "passwordHash,asc")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/users").cookie(cookie(admin)).param("role", "SUPERUSER")).andExpect(status().isBadRequest());
    }
    @Test void unverifiedAdministratorsCannotMutateCommunityData() throws Exception {
        var admin = create("changed-address@example.test", "ADMIN");
        admin.changeEmail("unverified-address@example.test"); users.flush();
        for (String path : java.util.List.of("/api/admin/recipes/1/unpublish", "/api/admin/users/1/block", "/api/admin/users/1/unblock",
            "/api/admin/reports/1/decision", "/api/admin/media/cleanup")) {
            mvc.perform(post(path).cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        }
    }
    @Test void databasePaginationFiltersSortingAndTotalsCoverAllRowSizes() throws Exception {
        var admin = create("pagination-admin@example.test", "ADMIN");
        String hash = passwords.encode(password);
        for (int i = 0; i < 23; i++) {
            var person = DemoUserEntity.account(String.format("Pagination %02d", i), "page" + i + "@example.test", hash, "USER");
            person.verifyEmail(); users.saveAndFlush(person);
            long reportId = service.report(person.getId(), 1, new AdministrationService.ReportInput(RecipeReport.Reason.OTHER, "")).id();
            service.decide(admin.getId(), reportId, new AdministrationService.Decision(RecipeReport.Status.RESOLVED, "Проверено"));
        }
        users.flush();
        jdbc.update("update recipe_reports set created_at = timestamp with time zone '2026-01-01 00:00:00+00' where reporter_id in (select id from demo_users where email like 'page%@example.test')");
        jdbc.update("update administrative_audit set created_at = timestamp with time zone '2026-01-01 00:00:00+00' where admin_id = ?", admin.getId());
        for (int size : new int[]{10, 20, 50}) {
            mvc.perform(get("/api/admin/users").cookie(cookie(admin)).param("search", "Pagination ").param("role", "USER")
                .param("status", "ACTIVE").param("sort", "name,asc").param("size", String.valueOf(size)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(23))
                .andExpect(jsonPath("$.content.length()").value(Math.min(size, 23)))
                .andExpect(jsonPath("$.content[0].name").value("Pagination 00"));
            mvc.perform(get("/api/admin/reports").cookie(cookie(admin)).param("status", "RESOLVED").param("sort", "id,asc")
                .param("search", "Pagination ").param("size", String.valueOf(size)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(23))
                .andExpect(jsonPath("$.content.length()").value(Math.min(size, 23)));
            mvc.perform(get("/api/admin/audit").cookie(cookie(admin)).param("action", "REPORT_RESOLVED").param("size", String.valueOf(size)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(23))
                .andExpect(jsonPath("$.content.length()").value(Math.min(size, 23)));
        }
        mvc.perform(get("/api/admin/users").cookie(cookie(admin)).param("search", "Pagination ").param("sort", "name,asc").param("role", "USER")
            .param("size", "10").param("page", "2")).andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(3)).andExpect(jsonPath("$.content[0].name").value("Pagination 20"));
        for (String endpoint : java.util.List.of("/api/admin/reports?sort=createdAt,desc&status=RESOLVED", "/api/admin/audit?action=REPORT_RESOLVED")) {
            var response = mvc.perform(get(endpoint).cookie(cookie(admin)).param("size", "50"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            var content = json.readTree(response).get("content");
            assertEquals(23, content.size());
            for (int i = 1; i < content.size(); i++) assertTrue(content.get(i - 1).get("id").asLong() > content.get(i).get("id").asLong());
        }
    }
    @Test void unpublishingIsProtectedAuditedAndPreservesTheRecipe() throws Exception {
        var admin = create("publisher@example.test", "ADMIN"); var owner = create("reader@example.test", "USER");
        mvc.perform(post("/api/admin/recipes/1/unpublish").cookie(cookie(owner)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"Проверка содержания\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/recipes/1/unpublish").cookie(cookie(admin)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"Проверка содержания\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/recipes/1/unpublish").cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"Проверка содержания\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(get("/api/recipes/1")).andExpect(status().isNotFound());
        mvc.perform(get("/api/recipes/1").cookie(cookie(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.ingredients").isNotEmpty());
        mvc.perform(post("/api/admin/recipes/1/unpublish").cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"Повторное действие\"}")).andExpect(status().isConflict());
        mvc.perform(get("/api/admin/audit").cookie(cookie(admin)).param("action", "RECIPE_UNPUBLISHED"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.content[0].adminName").value(admin.toModel().name()));
        mvc.perform(post("/api/recipes/1/moderate").cookie(cookie(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"APPROVED\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/recipes/1")).andExpect(status().isOk());
    }
}
