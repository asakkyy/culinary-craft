package com.culinarycraft.model;

public record DemoUser(long id, String name, String role, String initials, String subtitle) {
    public boolean admin() { return "ADMIN".equals(role); }
}
