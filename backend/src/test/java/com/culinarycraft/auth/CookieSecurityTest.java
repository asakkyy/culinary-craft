package com.culinarycraft.auth;

import com.culinarycraft.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// A fresh filter chain: SecurityMockMvcRequestPostProcessors.csrf() replaces its repository.
@SpringBootTest(properties = "test.real-csrf-cookie=true")
class CookieSecurityTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Test void realCsrfCookieHasBrowserSecurityAttributes() throws Exception {
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk())
            .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                org.hamcrest.Matchers.containsString("Secure"), org.hamcrest.Matchers.containsString("HttpOnly"))))
            // MockHttpServletResponse does not serialize arbitrary Servlet 6 cookie attributes.
            .andExpect(result -> org.junit.jupiter.api.Assertions.assertEquals("Strict",
                result.getResponse().getCookie("XSRF-TOKEN").getAttribute("SameSite")));
    }
}
