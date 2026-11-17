package com.culinarycraft.media;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "media_files")
public class MediaFile {
    @Id private UUID id;
    @Column(nullable = false) private long ownerId;
    private Long recipeId;
    @Column(nullable = false) private String kind;
    @Column(nullable = false) private long sizeBytes;
    @Column(nullable = false) private int width;
    @Column(nullable = false) private int height;
    @Column(nullable = false) private Instant createdAt;
    protected MediaFile() {}
    public MediaFile(UUID id, long ownerId, Long recipeId, String kind, long size, int width, int height) {
        this.id = id; this.ownerId = ownerId; this.recipeId = recipeId; this.kind = kind;
        sizeBytes = size; this.width = width; this.height = height; createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public long getOwnerId() { return ownerId; }
    public Long getRecipeId() { return recipeId; }
    public String getKind() { return kind; }
    public String url() { return "/api/media/" + id; }
}
