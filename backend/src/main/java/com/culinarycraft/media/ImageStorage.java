package com.culinarycraft.media;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ImageStorage {
    public static final long MAX_BYTES = 5 * 1024 * 1024;
    private final Path root;
    public record Stored(UUID id, long bytes, int width, int height) {}
    public ImageStorage(@Value("${MEDIA_ROOT:./data/media}") String directory) throws IOException {
        root = Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(root);
        if (Files.isSymbolicLink(root)) throw new IOException("Media directory must not be a symlink");
    }
    private Path path(UUID id) { return root.resolve(id.toString() + ".png"); }
    Path directory() { return root; }
    public Stored write(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Изображение должно быть от 1 байта до 5 МБ");
        }
        Path temporary = null;
        boolean writing = false;
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Требуется PNG или JPEG");
            var reader = readers.next();
            BufferedImage image;
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!Set.of("png", "jpeg", "jpg").contains(format)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Требуется PNG или JPEG");
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 12000000) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Слишком большие размеры изображения");
                }
                image = reader.read(0);
            } finally { reader.dispose(); }
            UUID id = UUID.randomUUID();
            writing = true;
            temporary = Files.createTempFile(root, ".upload-", ".tmp");
            if (!ImageIO.write(image, "PNG", temporary.toFile())) throw new IOException("PNG encoder unavailable");
            long bytes = Files.size(temporary);
            if (bytes > MAX_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "PNG после обработки превышает 5 МБ");
            // Fail safely if the filesystem does not support an atomic move.
            Files.move(temporary, path(id), StandardCopyOption.ATOMIC_MOVE);
            return new Stored(id, bytes, image.getWidth(), image.getHeight());
        } catch (ResponseStatusException error) { throw error;
        } catch (IOException | RuntimeException error) {
            throw new ResponseStatusException(writing ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST,
                writing ? "Хранилище временно недоступно" : "Изображение не обработано");
        } finally {
            if (temporary != null) try { Files.deleteIfExists(temporary); } catch (IOException error) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Could not clean temporary media file");
            }
        }
    }
    public byte[] read(UUID id) {
        try {
            Path file = path(id);
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException();
            if (Files.size(file) > MAX_BYTES) throw new IOException();
            return Files.readAllBytes(file);
        } catch (IOException error) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Изображение недоступно"); }
    }
    public void delete(UUID id) {
        try { Files.deleteIfExists(path(id)); } catch (IOException error) {
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Unreferenced media requires cleanup: {}", id);
        }
    }
}
