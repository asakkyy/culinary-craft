package com.culinarycraft.admin;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "administrative_audit")
public class AuditEvent {
    public enum Action { USER_BLOCKED, USER_UNBLOCKED, REPORT_IN_REVIEW, REPORT_RESOLVED, REPORT_REJECTED, RECIPE_APPROVED, RECIPE_REJECTED, RECIPE_UNPUBLISHED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private long adminId;
    @Enumerated(EnumType.STRING) private Action action;
    private String targetType;
    private long targetId;
    private Instant createdAt;
    private String details;
    protected AuditEvent() {}
    public AuditEvent(long admin, Action action, String type, long target, String details) {
        adminId = admin; this.action = action; targetType = type; targetId = target;
        createdAt = Instant.now(); this.details = details;
    }
    public record View(long id, long adminId, Action action, String targetType, long targetId, Instant createdAt, String details, String adminName) {}
    public View view() { return view(null); }
    public View view(String name) { return new View(id, adminId, action, targetType, targetId, createdAt, details, name); }
}
