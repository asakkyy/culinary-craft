package com.culinarycraft.api;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.culinarycraft.PostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.culinarycraft.model.RecipeRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Full Spring MVC integration tests: JSON validation, headers, controller, service. */
class RecipeApiIntegrationTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String request(String title) throws Exception {
        return json.writeValueAsString(new RecipeRequest(title,
            "Пошаговое описание простого вкусного домашнего блюда", "Супы", "🍜", "", 30, 2, "Легко",
            List.of("Вода", "Морковь"), List.of("Вскипятить", "Сварить"), List.of("Домашнее")));
    }

    private long createRecipe(String title) throws Exception {
        String result = mvc.perform(post("/api/recipes").with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L)))
            .contentType(MediaType.APPLICATION_JSON).content(request(title)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"))
            .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(result);
        return node.get("id").asLong();
    }

    @Test void healthEndpointWorks() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"))
            .andExpect(jsonPath("$.storage").value("POSTGRESQL"));
    }

    @Test void demoUsersAndRolesAreAvailable() throws Exception {
        mvc.perform(get("/api/users/demo")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[2].role").value("ADMIN"));
    }

    @Test void anonymousCatalogCanFilterAndPaginate() throws Exception {
        mvc.perform(get("/api/recipes").param("category", "Десерты")
                .param("size", "2").param("page", "0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.size").value(2))
            .andExpect(jsonPath("$.content").isArray());
        mvc.perform(get("/api/recipes").param("search", "不存在_такого_рецепта"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
    }

    @Test void recipeDetailContainsIngredientsStepsAndReviews() throws Exception {
        mvc.perform(get("/api/recipes/1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ingredients").isArray())
            .andExpect(jsonPath("$.steps").isArray());
        mvc.perform(get("/api/recipes/1/reviews"))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
    }

    @Test void guestCannotCreate() throws Exception {
        mvc.perform(post("/api/recipes").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(request("Безымянный суп")))
            .andExpect(status().isUnauthorized());
    }

    @Test void invalidRecipeReturns400AndFieldMessage() throws Exception {
        mvc.perform(post("/api/recipes").with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"a\",\"description\":\"b\",\"category\":\"Супы\",\"prepMinutes\":0,\"servings\":0,\"difficulty\":\"Легко\",\"ingredients\":[],\"steps\":[]}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
    }

    @Test void newRecipeIsHiddenUntilModeratorApproves() throws Exception {
        long id = createRecipe("Суп из тестового сценария");
        mvc.perform(get("/api/recipes/" + id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/recipes/" + id).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(get("/api/recipes/pending").with(jwt().jwt(j -> j.subject("3").claim("uid", 3L))))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        mvc.perform(post("/api/recipes/" + id + "/moderate").with(csrf()).with(jwt().jwt(j -> j.subject("3").claim("uid", 3L)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"APPROVED\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        mvc.perform(get("/api/recipes/" + id)).andExpect(status().isOk());
    }

    @Test void regularUserCannotModerate() throws Exception {
        long id = createRecipe("Суп для проверки ролей");
        mvc.perform(post("/api/recipes/" + id + "/moderate").with(csrf()).with(jwt().jwt(j -> j.subject("2").claim("uid", 2L)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"APPROVED\"}"))
            .andExpect(status().isForbidden());
    }

    @Test void ownerCanUpdateButDifferentUserCannot() throws Exception {
        long id = createRecipe("Суп для редактирования");
        mvc.perform(put("/api/recipes/" + id).with(csrf()).with(jwt().jwt(j -> j.subject("2").claim("uid", 2L)))
                .contentType(MediaType.APPLICATION_JSON).content(request("Чужое изменение")))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/recipes/" + id).with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L)))
                .contentType(MediaType.APPLICATION_JSON).content(request("Исправленный суп")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Исправленный суп"));
    }

    @Test void ownerCanDeleteCreatedRecipe() throws Exception {
        long id = createRecipe("Удаляемый рецепт");
        mvc.perform(delete("/api/recipes/" + id).with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L))))
            .andExpect(status().isOk());
        mvc.perform(get("/api/recipes/" + id).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L))))
            .andExpect(status().isNotFound());
    }

    @Test void favoritesAreUserSpecific() throws Exception {
        mvc.perform(post("/api/recipes/1/favorite").with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.favorite").isBoolean());
        mvc.perform(get("/api/recipes/favorites").with(jwt().jwt(j -> j.subject("2").claim("uid", 2L))))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
    }

    @Test void reviewValidationAndDuplicateReviewAreChecked() throws Exception {
        mvc.perform(post("/api/recipes/1/reviews").with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":9,\"comment\":\"ok\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/recipes/1/reviews").with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":4,\"comment\":\"Очень вкусно\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rating").value(4));
        mvc.perform(post("/api/recipes/1/reviews").with(csrf()).with(jwt().jwt(j -> j.subject("1").claim("uid", 1L)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":5,\"comment\":\"Повторный отзыв\"}"))
            .andExpect(status().isConflict());
    }
}
