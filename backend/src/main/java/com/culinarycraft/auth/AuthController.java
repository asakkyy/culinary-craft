package com.culinarycraft.auth;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AccountService accounts;
    private final TokenService tokens;
    private final boolean secure;
    private final AuthenticationLimits limits;
    public AuthController(AccountService accounts, TokenService tokens,
                          @Value("${COOKIE_SECURE:true}") boolean secure, AuthenticationLimits limits) {
        this.accounts = accounts; this.tokens = tokens; this.secure = secure; this.limits = limits;
    }
    @GetMapping("/csrf") public java.util.Map<String, String> csrf(CsrfToken token) {
        return java.util.Map.of("token", token.getToken());
    }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public AccountView register(@Valid @RequestBody AccountService.Registration request) { return accounts.register(request); }
    @PostMapping("/login") public AccountView login(@Valid @RequestBody AccountService.Login request, HttpServletResponse response) {
        if (!limits.allow("login-account", request.email().strip().toLowerCase(java.util.Locale.ROOT), 10, 600)) {
            response.setHeader("Retry-After", "600");
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Слишком много попыток входа. Повторите через 10 минут");
        }
        var account = accounts.login(request);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(tokens.issue(account), 1800).toString());
        return AccountView.of(account);
    }
    @GetMapping("/me") public AccountView me(@AuthenticationPrincipal Jwt jwt) { return accounts.me(Long.parseLong(jwt.getSubject())); }
    @PostMapping("/logout") public void logout(@AuthenticationPrincipal Jwt jwt, HttpServletResponse response) {
        accounts.logout(Long.parseLong(jwt.getSubject()));
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", 0).toString());
    }
    private ResponseCookie cookie(String token, int seconds) {
        return ResponseCookie.from("cc-session", token).httpOnly(true).secure(secure).sameSite("Strict")
            .path("/api").maxAge(seconds).build();
    }
}
