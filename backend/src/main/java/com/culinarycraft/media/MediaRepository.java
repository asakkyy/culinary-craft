package com.culinarycraft.media;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<MediaFile, UUID> {
    List<MediaFile> findByOwnerIdAndKind(long ownerId, String kind);
    List<MediaFile> findByRecipeId(long recipeId);
}
