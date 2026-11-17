package com.culinarycraft.auth;

import com.culinarycraft.persistence.DemoUserEntity;
import java.time.Instant;

public record AccountView(long id, String name, String email, String role, String status,
                          String initials, String subtitle, Instant registeredAt, Instant updatedAt, String avatarUrl, boolean emailVerified) {
    public static AccountView of(DemoUserEntity account) {
        var person = account.toModel();
        return new AccountView(person.id(), person.name(), account.getEmail(), person.role(),
            account.getStatus(), person.initials(), person.subtitle(), account.getRegisteredAt(),
            account.getUpdatedAt(), account.getAvatarUrl(), account.isEmailVerified());
    }
}
