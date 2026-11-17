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

class AuthApiTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DemoUserRepository users;
    @Autowired TokenService tokens;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entities;
    private final String password = "A long test password 123";
    private String body(String email, String password) throws Exception {
        return json.writeValueAsString(Map.of("name", "New author", "email", email, "password", password, "role", "ADMIN"));
    }
    private Cookie login() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body("author@example.test", password))).andExpect(status().isCreated())
            .andExpect(jsonPath("$.role").value("USER")).andExpect(jsonPath("$.passwordHash").doesNotExist());
        return mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body("AUTHOR@example.test", password))).andExpect(status().isOk())
            .andReturn().getResponse().getCookie("cc-session");
    }
    @Test void registrationLoginLogoutAndRevocation() throws Exception {
        Cookie cookie = login(); assertNotNull(cookie); assertTrue(cookie.isHttpOnly()); assertTrue(cookie.getSecure());
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("New author"));
        assertNotEquals(password, users.findByEmailIgnoreCase("author@example.test").orElseThrow().getPasswordHash());
        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").cookie(cookie).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
    }
    @Test void invalidAndDuplicateEmailsAndWrongPassword() throws Exception {
        login();
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body("AUTHOR@example.test", password))).andExpect(status().isConflict());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body("not-email", password))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body("other@example.test", "short"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(body("author@example.test", "wrong password"))).andExpect(status().isUnauthorized());
    }
    @Test void headerAndTamperedCookieCannotAuthenticate() throws Exception {
        mvc.perform(get("/api/recipes/mine").header("X-Demo-User", "3")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(new Cookie("cc-session", "tampered"))).andExpect(status().isUnauthorized());
        Cookie cookie = login();
        mvc.perform(get("/api/recipes/pending").cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/recipes/1").cookie(cookie).with(csrf())).andExpect(status().isForbidden());
    }
    @Test void expiredTokenAndBlockedAccountAreRejected() throws Exception {
        Cookie cookie = login();
        var key = new javax.crypto.spec.SecretKeySpec(java.util.Base64.getDecoder().decode(System.getenv("JWT_SECRET")), "HmacSHA256");
        var encoder = new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(new com.nimbusds.jose.jwk.source.ImmutableSecret<>(key));
        var claims = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder().issuer("culinary-craft")
            .subject("1001").audience(java.util.List.of("culinary-browser"))
            .issuedAt(java.time.Instant.now().minusSeconds(7200)).expiresAt(java.time.Instant.now().minusSeconds(3600)).build();
        var expired = encoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
            org.springframework.security.oauth2.jwt.JwsHeader.with(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(), claims)).getTokenValue();
        mvc.perform(get("/api/auth/me").cookie(new Cookie("cc-session", expired))).andExpect(status().isUnauthorized());
        jdbc.update("update demo_users set status = 'BLOCKED' where email = 'author@example.test'");
        entities.clear();
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
    }
}
