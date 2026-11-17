package com.culinarycraft.auth;

import com.culinarycraft.persistence.*;
import jakarta.validation.constraints.*;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AccountService {
    public record Registration(@NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 12, max = 64) String password) {}
    public record Login(@NotBlank @Email @Size(max = 254) String email,
                        @NotBlank @Size(max = 64) String password) {}
    private final DemoUserRepository users;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    public AccountService(DemoUserRepository users, PasswordEncoder passwords) {
        this.users = users; this.passwords = passwords;
        dummyHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }
    public AccountView register(Registration request) {
        if (request.name().strip().length() < 2 || request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid name or password length");
        }
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        if (users.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        try {
            return AccountView.of(users.saveAndFlush(DemoUserEntity.account(request.name().strip(), email,
                passwords.encode(request.password()), "USER")));
        } catch (org.springframework.dao.DataIntegrityViolationException error) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
    }
    public DemoUserEntity login(Login request) {
        var account = users.findByEmailIgnoreCase(request.email().strip()).orElse(null);
        String hash = account == null || account.getPasswordHash() == null ? dummyHash : account.getPasswordHash();
        boolean matches = passwords.matches(request.password(), hash);
        if (!matches || account == null || !"ACTIVE".equals(account.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        return account;
    }
    public AccountView me(long id) { return AccountView.of(users.findById(id).orElseThrow()); }
    public void logout(long id) { users.lockById(id).orElseThrow().revokeTokens(); }
}
