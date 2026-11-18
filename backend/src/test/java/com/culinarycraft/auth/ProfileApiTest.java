package com.culinarycraft.auth;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.persistence.DemoUserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

class ProfileApiTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AccountService accounts;
    @Autowired TokenService tokens;
    @Autowired ObjectMapper json;
    @Autowired DemoUserRepository users;
    private final String password = "Test current password 123";
    private Cookie account(String email) {
        accounts.register(new AccountService.Registration("Original", email, password));
        return new Cookie("cc-session", tokens.issue(accounts.login(new AccountService.Login(email, password))));
    }
    @Test void nameOnlyChangesAuthenticatedAccount() throws Exception {
        var cookie = account("owner@example.test"); account("other@example.test");
        mvc.perform(put("/api/account/profile").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("name", "New Name", "id", 1, "role", "ADMIN", "status", "BLOCKED"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("New Name"))
            .andExpect(jsonPath("$.role").value("USER")).andExpect(jsonPath("$.status").value("ACTIVE"));
        assertEquals("Original", users.findByEmailIgnoreCase("other@example.test").orElseThrow().toModel().name());
        mvc.perform(put("/api/account/1/profile").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Attack\"}")).andExpect(status().isNotFound());
        mvc.perform(put("/api/account/profile").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Attack\"}")).andExpect(status().isUnauthorized());
    }
    @Test void emailRequiresPasswordAndIsUnique() throws Exception {
        var cookie = account("owner@example.test"); account("other@example.test");
        mvc.perform(put("/api/account/email").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", "new@example.test", "currentPassword", "wrong"))))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/account/email").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", "OTHER@example.test", "currentPassword", password))))
            .andExpect(status().isConflict());
        mvc.perform(put("/api/account/email").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", "NEW@example.test", "currentPassword", password))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("new@example.test"));
    }
    @Test void passwordChangeRevokesOldSessionsAndRequiresCurrentPassword() throws Exception {
        var cookie = account("owner@example.test");
        mvc.perform(put("/api/account/password").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("currentPassword", "wrong", "newPassword", "New secure password 456"))))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/account/password").cookie(cookie).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("currentPassword", password, "newPassword", "New secure password 456"))))
            .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        assertNotNull(accounts.login(new AccountService.Login("owner@example.test", "New secure password 456")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
            () -> accounts.login(new AccountService.Login("owner@example.test", password)));
    }
}
