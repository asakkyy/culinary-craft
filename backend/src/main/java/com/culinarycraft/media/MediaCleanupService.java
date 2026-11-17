package com.culinarycraft.media;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Only this application's generated filenames are eligible. Never recursively deletes or follows links. */
@Service
@Transactional
public class MediaCleanupService {
    public record Report(boolean dryRun, int scanned, List<String> candidates, long bytes, int deleted, int failed, boolean hasMore) {}
    private final ImageStorage storage;
    private final MediaReferences references;
    private final Duration grace;
    private final com.culinarycraft.service.DemoUserService permissions;
    public MediaCleanupService(ImageStorage storage, MediaReferences references, com.culinarycraft.service.DemoUserService permissions,
        @Value("${MEDIA_ORPHAN_GRACE_HOURS:24}") long hours) {
        this.storage = storage; this.references = references; this.permissions = permissions;
        if (hours < 24 || hours > 8760) throw new IllegalArgumentException("MEDIA_ORPHAN_GRACE_HOURS must be 24..8760");
        grace = Duration.ofHours(hours);
    }
    public Report forAdmin(long actor, boolean dryRun) { permissions.requireAdmin(actor); return cleanup(dryRun); }
    public Report cleanup(boolean dryRun) {
        references.cleaning(); // Waits for every participating upload transaction, across JVMs using this database.
        if (!Files.isDirectory(storage.directory(), LinkOption.NOFOLLOW_LINKS)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Хранилище недоступно для проверки");
        }
        Instant cutoff = Instant.now().minus(grace);
        var candidates = new ArrayList<String>(); long bytes = 0; int scanned = 0, deleted = 0, failed = 0;
        try (var entries = Files.newDirectoryStream(storage.directory())) {
            for (Path path : entries) {
                scanned++;
                BasicFileAttributes before;
                try { before = Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS); }
                catch (NoSuchFileException removed) { continue; }
                catch (IOException error) { failed++; continue; }
                String name = path.getFileName().toString();
                UUID id = imageId(name);
                boolean temporary = name.matches("\\.upload-[A-Za-z0-9_-]+\\.tmp");
                if (!before.isRegularFile() || !before.lastModifiedTime().toInstant().isBefore(cutoff)
                    || (id == null && !temporary) || (id != null && references.used(id))) continue;
                if (candidates.size() == 500) return new Report(dryRun, scanned, List.copyOf(candidates), bytes, deleted, failed, true);
                candidates.add(name); bytes += before.size();
                if (!dryRun) {
                    try {
                        // Recheck identity, age and database references immediately before unlinking.
                        var current = Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
                        if (current.isRegularFile() && Objects.equals(current.fileKey(), before.fileKey())
                            && current.lastModifiedTime().equals(before.lastModifiedTime()) && (id == null || !references.used(id))) {
                            if (Files.deleteIfExists(path)) deleted++;
                        }
                    } catch (IOException error) { failed++; }
                }
            }
        } catch (IOException error) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Хранилище недоступно для проверки"); }
        return new Report(dryRun, scanned, List.copyOf(candidates), bytes, deleted, failed, false);
    }
    private UUID imageId(String name) {
        if (!name.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png")) return null;
        return UUID.fromString(name.substring(0, 36));
    }
}
