package com.culinarycraft.media;

import com.culinarycraft.PostgresIntegrationTest;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.*;
import static org.junit.jupiter.api.Assertions.*;

class MediaCleanupTest extends PostgresIntegrationTest {
    static final String ROOT = Path.of(System.getenv("MEDIA_ROOT"), "cleanup-" + UUID.randomUUID()).toString();
    @DynamicPropertySource static void root(DynamicPropertyRegistry registry) { registry.add("MEDIA_ROOT", () -> ROOT); }
    @Autowired ImageStorage storage;
    @Autowired MediaCleanupService cleanup;
    @Autowired MediaRepository files;
    @Autowired MediaService media;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.culinarycraft.persistence.DemoUserRepository users;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired MediaReferences references;
    @Autowired org.springframework.test.web.servlet.MockMvc mvc;
    private Path old(String name) throws Exception {
        Path path = Files.writeString(storage.directory().resolve(name), "synthetic fixture");
        Files.setLastModifiedTime(path, FileTime.from(Instant.now().minusSeconds(172800))); return path;
    }
    private MockMultipartFile png() throws Exception {
        var out = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(3, 2, BufferedImage.TYPE_INT_RGB), "png", out);
        return new MockMultipartFile("file", "../../ignored.png", "image/png", out.toByteArray());
    }
    @Test void dryRunAndDeletionProtectMetadataReferencesRecentAndUnknownFiles() throws Exception {
        UUID live = UUID.randomUUID(), linked = UUID.randomUUID(), orphan = UUID.randomUUID();
        Path liveFile = old(live + ".png"), linkedFile = old(linked + ".png"), orphanFile = old(orphan + ".png");
        Path temporary = old(".upload-abandoned.tmp"), unknown = old("family-photo.png");
        Path recent = Files.writeString(storage.directory().resolve(UUID.randomUUID() + ".png"), "recent");
        files.saveAndFlush(new MediaFile(live, 1, null, "AVATAR", 10, 1, 1));
        jdbc.update("update demo_users set avatar_url = ? where id = 2", "/api/media/" + linked);
        var preview = cleanup.cleanup(true); assertEquals(0, preview.deleted());
        assertTrue(preview.candidates().contains(orphanFile.getFileName().toString())); assertTrue(Files.exists(orphanFile));
        var result = cleanup.cleanup(false); assertTrue(result.deleted() >= 2); assertFalse(Files.exists(orphanFile)); assertFalse(Files.exists(temporary));
        for (Path path : java.util.List.of(liveFile, linkedFile, unknown, recent)) assertTrue(Files.exists(path));
    }
    @Test @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void failedTransactionRemovesNewFileAndPreservesPreviouslyCommittedAvatar() throws Exception {
        var user = users.saveAndFlush(com.culinarycraft.persistence.DemoUserEntity.account("Media rollback", UUID.randomUUID() + "@test.invalid", "unusable-hash", "USER"));
        try {
            media.avatar(user.getId(), png());
            var original = files.findByOwnerIdAndKind(user.getId(), "AVATAR").get(0);
            var before = storage.read(original.getId());
            var tx = new org.springframework.transaction.support.TransactionTemplate(transactions);
            var replacement = new java.util.concurrent.atomic.AtomicReference<UUID>();
            tx.executeWithoutResult(status -> {
                try { media.avatar(user.getId(), png()); } catch (Exception error) { throw new IllegalStateException(error); }
                replacement.set(files.findByOwnerIdAndKind(user.getId(), "AVATAR").get(0).getId());
                status.setRollbackOnly();
            });
            assertFalse(Files.exists(storage.directory().resolve(replacement.get() + ".png")));
            assertEquals(original.getId(), files.findByOwnerIdAndKind(user.getId(), "AVATAR").get(0).getId());
            assertArrayEquals(before, storage.read(original.getId()));
            assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> media.avatar(user.getId(),
                new MockMultipartFile("file", "bad.png", "image/png", "not an image".getBytes())));
            assertArrayEquals(before, storage.read(original.getId()));
            media.deleteAvatar(user.getId()); assertFalse(Files.exists(storage.directory().resolve(original.getId() + ".png")));
        } finally { users.deleteById(user.getId()); }
    }
    @Test void filesystemFailureReturnsSafeError() throws Exception {
        Path root = Files.createTempDirectory(storage.directory(), "failed-"); var disk = new ImageStorage(root.toString());
        Files.delete(root); Files.writeString(root, "directory replaced by a file in test");
        var error = assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> disk.write(png()));
        assertEquals(503, error.getStatusCode().value()); assertFalse(error.getReason().contains(ROOT));
    }
    @Test void cleanupEndpointRequiresAdministratorAndExplicitMode() throws Exception {
        var administrator = com.culinarycraft.persistence.DemoUserEntity.account("Cleanup admin", "cleanup-admin@test.invalid", "unusable-fixture-hash", "ADMIN");
        administrator.verifyEmail(); users.saveAndFlush(administrator);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/media/cleanup")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
            .contentType("application/json").content("{\"dryRun\":true}"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        for (long id : new long[] {1, administrator.getId()}) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/media/cleanup")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject("" + id).claim("uid", id)))
                .contentType("application/json").content("{\"dryRun\":true}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().is(id == administrator.getId() ? 200 : 403));
        }
    }
    @Test @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void cleanupWaitsForAnUnfinishedUploadTransaction() throws Exception {
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        var acquired = new java.util.concurrent.CountDownLatch(1); var release = new java.util.concurrent.CountDownLatch(1);
        try {
            var upload = pool.submit(() -> new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
                references.uploading(); acquired.countDown();
                try { if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("Timed out waiting in upload fixture"); }
                catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
                return true;
            }));
            assertTrue(acquired.await(3, java.util.concurrent.TimeUnit.SECONDS));
            var cleaner = pool.submit(() -> cleanup.cleanup(true));
            org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(3)).until(() ->
                jdbc.queryForObject("select count(*) from pg_locks where locktype = 'advisory' and objid = 61319488 and not granted", Integer.class) > 0);
            assertFalse(cleaner.isDone()); release.countDown();
            assertTrue(upload.get(5, java.util.concurrent.TimeUnit.SECONDS));
            assertTrue(cleaner.get(5, java.util.concurrent.TimeUnit.SECONDS).dryRun());
        } finally { release.countDown(); pool.shutdownNow(); }
    }
}
