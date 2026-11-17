package com.culinarycraft.auth;

import com.culinarycraft.persistence.*;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class ProfileService {
    public record Name(@NotBlank @Size(min = 2, max = 80) String name) {}
    public record Email(@NotBlank @jakarta.validation.constraints.Email @Size(max = 254) String email,
                        @NotBlank @Size(max = 64) String currentPassword) {
        @Override public String toString() { return "Email[redacted]"; }
    }
    public record Password(@NotBlank @Size(max = 64) String currentPassword,
                           @NotBlank @Size(min = 12, max = 64) String newPassword) {
        @Override public String toString() { return "Password[redacted]"; }
    }
    private final DemoUserRepository users;
    private final PasswordEncoder passwords;
    private final AccountEmailService emails;
    public ProfileService(DemoUserRepository users, PasswordEncoder passwords, AccountEmailService emails) { this.users = users; this.passwords = passwords; this.emails = emails; }
    private DemoUserEntity account(long id) {
        var user = users.lockById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!"ACTIVE".equals(user.getStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Аккаунт недоступен");
        return user;
    }
    private void confirm(DemoUserEntity user, String password) {
        if (!passwords.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Текущий пароль неверен");
        }
    }
    public AccountView name(long id, Name input) {
        String value = input.name().strip();
        if (value.length() < 2) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Имя слишком короткое");
        var user = account(id); user.rename(value); return AccountView.of(user);
    }
    public AccountView email(long id, Email input) {
        var user = account(id); confirm(user, input.currentPassword());
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent() && !existing.get().getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email уже используется");
        }
        user.changeEmail(email);
        try { users.flush(); } catch (org.springframework.dao.DataIntegrityViolationException error) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email уже используется");
        }
        emails.verification(id);
        return AccountView.of(user);
    }
    public void password(long id, Password input) {
        var user = account(id); confirm(user, input.currentPassword());
        if (input.newPassword().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Пароль превышает 72 байта UTF-8");
        }
        user.changePassword(passwords.encode(input.newPassword()));
    }
}
