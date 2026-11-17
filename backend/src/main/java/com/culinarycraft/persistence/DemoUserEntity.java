package com.culinarycraft.persistence;

import com.culinarycraft.model.DemoUser;
import jakarta.persistence.*;

@Entity
@Table(name = "demo_users")
public class DemoUserEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String role;
    @Column(nullable = false) private String initials;
    @Column(nullable = false) private String subtitle;

    protected DemoUserEntity() {}

    private String email;
    private String passwordHash;
    private String status;
    private java.time.Instant registeredAt;
    private java.time.Instant updatedAt;
    private String avatarUrl;
    private long tokenVersion;

    public static DemoUserEntity account(String name, String email, String hash, String role) {
        var account = new DemoUserEntity();
        account.name = name; account.email = email; account.passwordHash = hash;
        account.role = role; account.status = "ACTIVE";
        account.initials = name.substring(0, 1).toUpperCase(java.util.Locale.ROOT);
        account.subtitle = ""; account.registeredAt = java.time.Instant.now();
        account.updatedAt = account.registeredAt;
        return account;
    }
    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getStatus() { return status; }
    public String getRole() { return role; }
    public long getTokenVersion() { return tokenVersion; }
    public void revokeTokens() { tokenVersion++; }
    public java.time.Instant getRegisteredAt() { return registeredAt; }
    public java.time.Instant getUpdatedAt() { return updatedAt; }
    public String getAvatarUrl() { return avatarUrl; }

    public DemoUser toModel() { return new DemoUser(id, name, role, initials, subtitle); }
}
