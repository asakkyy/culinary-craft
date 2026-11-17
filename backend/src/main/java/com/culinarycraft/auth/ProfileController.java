package com.culinarycraft.auth;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/account")
public class ProfileController {
    private final ProfileService profiles;
    public ProfileController(ProfileService profiles) { this.profiles = profiles; }
    @PutMapping("/profile") public AccountView name(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileService.Name input) {
        return profiles.name(Long.parseLong(jwt.getSubject()), input);
    }
    @PutMapping("/email") public AccountView email(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileService.Email input) {
        return profiles.email(Long.parseLong(jwt.getSubject()), input);
    }
    @PutMapping("/password") public void password(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileService.Password input) {
        profiles.password(Long.parseLong(jwt.getSubject()), input);
    }
}
