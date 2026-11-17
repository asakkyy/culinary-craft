package com.culinarycraft.persistence;

import com.culinarycraft.model.DemoUser;
import jakarta.persistence.*;

@Entity
@Table(name = "demo_users")
public class DemoUserEntity {
    @Id private Long id;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String role;
    @Column(nullable = false) private String initials;
    @Column(nullable = false) private String subtitle;

    protected DemoUserEntity() {}

    public DemoUser toModel() { return new DemoUser(id, name, role, initials, subtitle); }
}
