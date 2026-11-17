package com.culinarycraft.auth;

import com.culinarycraft.persistence.*;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name = "BOOTSTRAP_ADMIN", havingValue = "true")
public class AdminBootstrap implements ApplicationRunner {
    private final DemoUserRepository users;
    private final PasswordEncoder passwords;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entities;
    @Value("${ADMIN_EMAIL}") private String email;
    @Value("${ADMIN_PASSWORD}") private String password;
    public AdminBootstrap(DemoUserRepository users, PasswordEncoder passwords) { this.users = users; this.passwords = passwords; }
    @Override @Transactional public void run(ApplicationArguments args) {
        entities.createNativeQuery("select pg_advisory_xact_lock(91273561)").getSingleResult();
        if (users.existsByRoleAndStatus("ADMIN", "ACTIVE")) return;
        if (password.length() < 16 || password.length() > 64 || !email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw new IllegalArgumentException("Provide a valid ADMIN_EMAIL and a 16-64 character ADMIN_PASSWORD");
        }
        if (users.findByEmailIgnoreCase(email.strip()).isPresent()) throw new IllegalStateException("Admin email already in use");
        users.saveAndFlush(DemoUserEntity.account("Administrator", email.strip().toLowerCase(java.util.Locale.ROOT), passwords.encode(password), "ADMIN"));
    }
}
