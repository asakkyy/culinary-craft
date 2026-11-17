package com.culinarycraft.auth;

import com.culinarycraft.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

class SecurityHardeningTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AuthenticationLimits limits;
    @Test void loginAccountLimitSurvivesFailuresAndDifferentAddresses() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/auth/login").with(csrf()).with(r -> { r.setRemoteAddr(java.util.UUID.randomUUID().toString()); return r; })
                .contentType("application/json").content("{\"email\":\"missing@example.test\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
            .content("{\"email\":\"MISSING@example.test\",\"password\":\"wrong\"}"))
            .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "600"));
    }
    @Test void malformedRegistrationCannotBypassIpLimitWithForwardedHeaders() throws Exception {
        for (int i = 0; i < 10; i++) mvc.perform(post("/api/auth/register").with(csrf())
            .header("X-Forwarded-For", "192.0.2." + i).contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").with(csrf()).header("X-Forwarded-For", "192.0.2.99"))
            .andExpect(status().isTooManyRequests());
    }
    @Test void csrfCookieAndMalformedInputHaveSafeResponses() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{broken"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Некорректный формат запроса"));
        mvc.perform(get("/api/account/unknown")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
}
