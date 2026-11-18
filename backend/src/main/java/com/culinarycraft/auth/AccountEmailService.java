package com.culinarycraft.auth;

import com.culinarycraft.persistence.*;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AccountEmailService {
    public record Address(@NotBlank @Email @Size(max = 254) String email) {}
    public record Token(@NotBlank @Size(min = 43, max = 43) String token) {
        @Override public String toString() { return "Token[redacted]"; }
    }
    public record Reset(@NotBlank @Size(min = 43, max = 43) String token,
                        @NotBlank @Size(min = 12, max = 64) String password) {
        @Override public String toString() { return "Reset[redacted]"; }
    }
    public record Mail(String recipient, String subject, String text) {
        @Override public String toString() { return "Mail[redacted]"; }
    }
    private final DemoUserRepository users;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final AuthenticationLimits limits;
    private final ApplicationEventPublisher events;
    private final String appUrl;
    private final SecureRandom random = new SecureRandom();
    public AccountEmailService(DemoUserRepository users, JdbcTemplate jdbc, PasswordEncoder passwords,
        AuthenticationLimits limits, ApplicationEventPublisher events, @Value("${PUBLIC_APP_URL:http://127.0.0.1:5173}") String appUrl) {
        this.users = users; this.jdbc = jdbc; this.passwords = passwords; this.limits = limits; this.events = events;
        var uri = java.net.URI.create(appUrl);
        if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
            || uri.getQuery() != null || uri.getFragment() != null || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) {
            throw new IllegalArgumentException("PUBLIC_APP_URL must be an explicit HTTP(S) origin");
        }
        this.appUrl = appUrl.replaceAll("/+$", "");
    }
    public static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    public void request(String email, String purpose) {
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        // Apply the same suppression to existing and unknown addresses; never expose suppression in the response.
        if (!limits.allow("email-" + purpose, normalized, 1, 60) || !limits.allow("email-daily-" + purpose, normalized, 5, 86400)) return;
        var found = users.findByEmailIgnoreCase(normalized);
        if (found.isEmpty()) return;
        var user = users.lockById(found.get().getId()).orElseThrow();
        if (!"ACTIVE".equals(user.getStatus()) || (purpose.equals("VERIFY") && user.isEmailVerified())) return;
        issue(user, purpose);
    }
    private void issue(DemoUserEntity user, String purpose) {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("delete from account_email_tokens where expires_at < current_timestamp or (user_id = ? and purpose = ?)", user.getId(), purpose);
        jdbc.update("insert into account_email_tokens(token_hash,user_id,purpose,email,token_version,expires_at) values (?,?,?,?,?,?)",
            hash(token), user.getId(), purpose, user.getEmail(), user.getTokenVersion(),
            java.sql.Timestamp.from(Instant.now().plusSeconds(purpose.equals("VERIFY") ? 86400 : 1800)));
        String path = purpose.equals("VERIFY") ? "/verify-email" : "/reset-password";
        events.publishEvent(new Mail(user.getEmail(), purpose.equals("VERIFY") ? "Culinary Craft: подтвердите email" : "Culinary Craft: восстановление пароля",
            "Откройте ссылку и подтвердите действие:\n" + appUrl + path + "#token=" + token
                + "\nЕсли вы не запрашивали это действие, проигнорируйте письмо. Никому не передавайте ссылку."));
    }
    private DemoUserEntity consume(String raw, String purpose) {
        String hash = hash(raw);
        var ids = jdbc.queryForList("select user_id from account_email_tokens where token_hash = ? and purpose = ?", Long.class, hash, purpose);
        if (ids.isEmpty()) throw invalid();
        var user = users.lockById(ids.get(0)).orElseThrow(AccountEmailService::invalid);
        var rows = jdbc.queryForList("select email,token_version,expires_at from account_email_tokens where token_hash = ? and purpose = ? for update", hash, purpose);
        if (rows.isEmpty()) throw invalid();
        var row = rows.get(0);
        if (!"ACTIVE".equals(user.getStatus()) || !user.getEmail().equals(row.get("email"))
            || ((Number) row.get("token_version")).longValue() != user.getTokenVersion()
            || !((java.sql.Timestamp) row.get("expires_at")).toInstant().isAfter(Instant.now())) throw invalid();
        jdbc.update("delete from account_email_tokens where token_hash = ?", hash);
        return user;
    }
    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ссылка недействительна или истекла. Запросите новую"); }
    public void verify(String raw) { consume(raw, "VERIFY").verifyEmail(); }
    public void reset(Reset input) {
        if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Пароль превышает 72 байта UTF-8");
        var user = consume(input.token(), "RESET");
        user.changePassword(passwords.encode(input.password())); user.verifyEmail();
        jdbc.update("delete from account_email_tokens where user_id = ?", user.getId());
    }
}
