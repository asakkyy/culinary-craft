package com.culinarycraft.admin;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.auth.*;
import com.culinarycraft.persistence.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

class AdministrationApiTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DemoUserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired TokenService tokens;
    @Autowired AdministrationService service;
    @Autowired AuditRepository audit;
    private final String password = "Test admin password 123";
    private DemoUserEntity create(String email, String role) {
        var user = DemoUserEntity.account("Author " + email, email, passwords.encode(password), role);
        user.verifyEmail(); return users.saveAndFlush(user);
    }
    private Cookie cookie(DemoUserEntity user) { return new Cookie("cc-session", tokens.issue(user)); }
    private String report() throws Exception { return json.writeValueAsString(Map.of("reason", "SPAM", "description", "Подробная причина жалобы на рецепт")); }
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
