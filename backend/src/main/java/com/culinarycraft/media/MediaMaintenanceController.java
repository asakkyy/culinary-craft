package com.culinarycraft.media;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class MediaMaintenanceController {
    public record Input(@NotNull Boolean dryRun) {}
    private final MediaCleanupService cleanup;
    public MediaMaintenanceController(MediaCleanupService cleanup) { this.cleanup = cleanup; }
    @PostMapping("/api/admin/media/cleanup")
    public MediaCleanupService.Report cleanup(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Input input) {
        return cleanup.forAdmin(Long.parseLong(jwt.getSubject()), input.dryRun());
    }
}
