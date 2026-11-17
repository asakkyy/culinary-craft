package com.culinarycraft.auth;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/auth")
public class AccountEmailController {
    private final AccountEmailService service;
    private final boolean secure;
    public AccountEmailController(AccountEmailService service, @org.springframework.beans.factory.annotation.Value("${COOKIE_SECURE:true}") boolean secure) {
        this.service = service; this.secure = secure;
    }
    @PostMapping("/verification/request") @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> verification(@Valid @RequestBody AccountEmailService.Address input) { service.request(input.email(), "VERIFY"); return accepted(); }
    @PostMapping("/password/request") @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> request(@Valid @RequestBody AccountEmailService.Address input) { service.request(input.email(), "RESET"); return accepted(); }
    @PostMapping("/verification/confirm") public void verify(@Valid @RequestBody AccountEmailService.Token input) { service.verify(input.token()); }
    @PostMapping("/password/reset") public void reset(@Valid @RequestBody AccountEmailService.Reset input, jakarta.servlet.http.HttpServletResponse response) {
        service.reset(input);
        response.addHeader("Set-Cookie", org.springframework.http.ResponseCookie.from("cc-session", "").httpOnly(true)
            .secure(secure).sameSite("Strict").path("/api").maxAge(0).build().toString());
    }
    public static Map<String, String> accepted() { return Map.of("message", "Если адрес подходит для операции, письмо будет отправлено. Проверьте почту"); }
}
