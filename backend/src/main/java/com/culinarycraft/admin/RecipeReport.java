package com.culinarycraft.admin;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "recipe_reports")
public class RecipeReport {
    public enum Reason { SPAM, ABUSE, COPYRIGHT, INCORRECT, OTHER }
    public enum Status { OPEN, IN_REVIEW, RESOLVED, REJECTED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private long reporterId;
    private long recipeId;
    private String recipeTitle;
    @Enumerated(EnumType.STRING) private Reason reason;
    @Column(length = 1000) private String description;
    @Enumerated(EnumType.STRING) private Status status;
    private Instant createdAt;
    private Long moderatorId;
    private Instant reviewedAt;
    @Column(length = 1000) private String moderatorComment;
    protected RecipeReport() {}
    public RecipeReport(long reporter, long recipe, String title, Reason reason, String description) {
        reporterId = reporter; recipeId = recipe; recipeTitle = title; this.reason = reason;
        this.description = description; status = Status.OPEN; createdAt = Instant.now();
    }
    public long getId() { return id; }
    public long getReporterId() { return reporterId; }
    public Status getStatus() { return status; }
    public Long getModeratorId() { return moderatorId; }
    public void decide(Status status, long moderator, String comment) {
        this.status = status; moderatorId = moderator; moderatorComment = comment;
        reviewedAt = status == Status.IN_REVIEW ? null : Instant.now();
    }
    public record View(long id, long reporterId, String reporterName, long recipeId, String recipeTitle,
                       Reason reason, String description, Status status, Instant createdAt,
                       Long moderatorId, Instant reviewedAt, String moderatorComment) {}
    public View view(String reporterName, boolean admin) {
        return new View(id, reporterId, reporterName, recipeId, recipeTitle, reason, description,
            status, createdAt, moderatorId, reviewedAt, admin ? moderatorComment : null);
    }
}
