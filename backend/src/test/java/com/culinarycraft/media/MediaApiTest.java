package com.culinarycraft.media;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.auth.*;
import com.culinarycraft.model.RecipeRequest;
import com.culinarycraft.service.RecipeService;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

class MediaApiTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AccountService accounts;
    @Autowired TokenService tokens;
    @Autowired RecipeService recipes;
    @Autowired MediaRepository files;
    @Autowired ImageStorage storage;
    private Cookie account(String email) {
        accounts.register(new AccountService.Registration("Author", email, "Test password 12345"));
        jdbcVerification(email);
        return new Cookie("cc-session", tokens.issue(accounts.login(new AccountService.Login(email, "Test password 12345"))));
    }
    private void jdbcVerification(String email) {
        files.flush();
        // Fixture for the already-verified author scenarios; verification itself has separate API tests.
        usersForVerification.findByEmailIgnoreCase(email).orElseThrow().verifyEmail();
    }
    @Autowired com.culinarycraft.persistence.DemoUserRepository usersForVerification;
    private MockMultipartFile png(String name) throws Exception {
        var out = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(4, 3, BufferedImage.TYPE_INT_RGB), "png", out);
        return new MockMultipartFile("file", name, "application/octet-stream", out.toByteArray());
    }
    @Test void avatarUploadReplacementAndDeletionUseOnlyGeneratedPaths() throws Exception {
        var cookie = account("avatar@example.test");
        mvc.perform(multipart("/api/account/avatar").file(png("../../escape.exe")).cookie(cookie).with(csrf()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.startsWith("/api/media/")));
        var original = files.findAll().get(0);
        mvc.perform(get(original.url())).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
        mvc.perform(multipart("/api/account/avatar").file(png("replacement.png")).cookie(cookie).with(csrf())).andExpect(status().isOk());
        assertEquals(1, files.count());
        mvc.perform(get(original.url())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/account/avatar").cookie(cookie).with(csrf())).andExpect(status().isOk());
        assertEquals(0, files.count());
    }
    @Test void invalidFormatsAndOversizedFilesFailWithoutChangingAvatar() throws Exception {
        var cookie = account("invalid@example.test");
        mvc.perform(multipart("/api/account/avatar").file(new MockMultipartFile("file", "fake.png", "image/png", "<svg/>".getBytes()))
            .cookie(cookie).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/account/avatar").file(new MockMultipartFile("file", "big.png", "image/png", new byte[(int) ImageStorage.MAX_BYTES + 1]))
            .cookie(cookie).with(csrf())).andExpect(status().isPayloadTooLarge());
        assertEquals(0, files.count());
    }
    @Test void recipeImageRespectsOwnershipVisibilityAndModeration() throws Exception {
        var owner = account("photo@example.test"); var other = account("other-photo@example.test");
        long ownerId = tokens.decode(owner.getValue()).getClaim("uid");
        var recipe = recipes.create(new RecipeRequest("Фото суп", "Подробное описание рецепта с фотографией", "Супы", "", "", 20, 2,
            "Легко", List.of("Вода"), List.of("Сварить"), List.of()), ownerId);
        mvc.perform(multipart("/api/recipes/" + recipe.id() + "/photo").file(png("cover.png")).cookie(other).with(csrf()))
            .andExpect(status().isForbidden());
        mvc.perform(multipart("/api/recipes/" + recipe.id() + "/photo").file(png("cover.png")).cookie(owner).with(csrf()))
            .andExpect(status().isOk());
        var image = files.findByRecipeId(recipe.id()).get(0);
        mvc.perform(get(image.url())).andExpect(status().isNotFound());
        mvc.perform(get(image.url()).cookie(owner)).andExpect(status().isOk());
        recipes.moderate(recipe.id(), "APPROVED", 3L);
        mvc.perform(get(image.url())).andExpect(status().isOk());
        mvc.perform(delete("/api/recipes/" + recipe.id() + "/photo").cookie(other).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/recipes/" + recipe.id() + "/photo").cookie(owner).with(csrf())).andExpect(status().isOk());
        assertEquals("PENDING", recipes.get(recipe.id(), ownerId).status());
    }
}
