package com.culinarycraft.auth;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.persistence.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.event.*;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@RecordApplicationEvents
class AccountEmailTest extends PostgresIntegrationTest {
    @Autowired AccountService accounts;
    @Autowired AccountEmailService emails;
    @Autowired DemoUserRepository users;
    @Autowired ApplicationEvents events;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired TokenService tokens;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    private final String password = "Original secure password 123";
    private AccountView register() { return accounts.register(new AccountService.Registration("Author", "mail@example.test", password)); }
    private String token() {
        var text = events.stream(AccountEmailService.Mail.class).reduce((first, second) -> second).orElseThrow().text();
        return text.substring(text.indexOf("#token=") + 7).split("\n")[0];
    }
    @Test void secretDtosDoNotDisclosePasswordsOrTokensInDebugMessages() {
        assertEquals("Registration[redacted]", new AccountService.Registration("Author", "mail@example.test", password).toString());
        assertEquals("Login[redacted]", new AccountService.Login("mail@example.test", password).toString());
        assertEquals("Password[redacted]", new ProfileService.Password(password, password).toString());
        assertEquals("Email[redacted]", new ProfileService.Email("mail@example.test", password).toString());
        assertEquals("Reset[redacted]", new AccountEmailService.Reset("secret", password).toString());
        assertEquals("Token[redacted]", new AccountEmailService.Token("secret").toString());
        assertEquals("Mail[redacted]", new AccountEmailService.Mail("mail@example.test", "subject", "secret").toString());
    }
    @Test void verificationIsSingleUseAndRequiredForContributions() throws Exception {
        var user = register(); String token = token();
        assertFalse(user.emailVerified()); assertEquals(43, token.length());
        assertEquals(AccountEmailService.hash(token), jdbc.queryForObject("select token_hash from account_email_tokens where user_id = ?", String.class, user.id()));
        var cookie = new Cookie("cc-session", tokens.issue(accounts.login(new AccountService.Login(user.email(), password))));
        mvc.perform(post("/api/recipes/1/favorite").cookie(cookie).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/verification/confirm").with(csrf()).contentType("application/json").content("{\"token\":\"" + token + "\"}"))
            .andExpect(status().isOk());
        assertTrue(accounts.me(user.id()).emailVerified());
        mvc.perform(post("/api/recipes/1/favorite").cookie(cookie).with(csrf())).andExpect(status().isOk());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> emails.verify(token));
    }
    @Test void resetRevokesSessionsIsSingleUseAndHidesAddressExistence() throws Exception {
        var user = register(); emails.verify(token()); events.clear();
        var cookie = new Cookie("cc-session", tokens.issue(accounts.login(new AccountService.Login(user.email(), password))));
        String known = mvc.perform(post("/api/auth/password/request").with(csrf()).contentType("application/json").content("{\"email\":\"mail@example.test\"}"))
            .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String token = token();
        String unknown = mvc.perform(post("/api/auth/password/request").with(csrf()).contentType("application/json").content("{\"email\":\"unknown@example.test\"}"))
            .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        assertEquals(known, unknown);
        mvc.perform(post("/api/auth/password/reset").with(csrf()).contentType("application/json")
            .content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(new AccountEmailService.Reset(token, "Replacement secure password 456"))))
            .andExpect(status().isOk()).andExpect(cookie().maxAge("cc-session", 0));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        assertNotNull(accounts.login(new AccountService.Login(user.email(), "Replacement secure password 456")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> emails.reset(new AccountEmailService.Reset(token, password)));
    }
    @Test void expiryResendInvalidationEmailBindingAndBlockedAccounts() {
        var user = register(); String first = token();
        events.clear(); emails.request(user.email(), "VERIFY"); assertEquals(0, events.stream(AccountEmailService.Mail.class).count());
        var separate = new org.springframework.transaction.support.TransactionTemplate(transactions);
        separate.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        separate.executeWithoutResult(status -> jdbc.update("update authentication_limits set window_start = current_timestamp - interval '2 hours'"));
        emails.request(user.email(), "VERIFY"); String replacement = token(); assertNotEquals(first, replacement);
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> emails.verify(first));
        jdbc.update("update account_email_tokens set expires_at = current_timestamp - interval '1 second'");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> emails.verify(replacement));
        emails.request(user.email(), "RESET"); String reset = token();
        users.findById(user.id()).orElseThrow().changeEmail("changed@example.test");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> emails.reset(new AccountEmailService.Reset(reset, password)));
        users.findById(user.id()).orElseThrow().block(true, "Test block");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> emails.reset(new AccountEmailService.Reset(reset, password)));
        assertEquals(0, jdbc.queryForObject("select count(*) from account_email_tokens where user_id in (1,2,3)", Integer.class));
    }
}
