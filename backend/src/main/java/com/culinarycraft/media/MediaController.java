package com.culinarycraft.media;

import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.culinarycraft.auth.AccountView;

@RestController
public class MediaController {
    private final MediaService media;
    public MediaController(MediaService media) { this.media = media; }
    @PostMapping("/api/account/avatar") public AccountView avatar(@AuthenticationPrincipal Jwt jwt, @RequestParam MultipartFile file) {
        return media.avatar(Long.parseLong(jwt.getSubject()), file);
    }
    @DeleteMapping("/api/account/avatar") public void deleteAvatar(@AuthenticationPrincipal Jwt jwt) { media.deleteAvatar(Long.parseLong(jwt.getSubject())); }
    @PostMapping("/api/recipes/{id}/photo") public MediaService.MediaView photo(@PathVariable long id, @AuthenticationPrincipal Jwt jwt, @RequestParam MultipartFile file) {
        return media.photo(id, Long.parseLong(jwt.getSubject()), file);
    }
    @DeleteMapping("/api/recipes/{id}/photo") public void deletePhoto(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        media.deletePhoto(id, Long.parseLong(jwt.getSubject()));
    }
    @GetMapping("/api/media/{id}") public ResponseEntity<byte[]> read(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff").body(media.read(id, jwt == null ? null : Long.parseLong(jwt.getSubject())));
    }
}
