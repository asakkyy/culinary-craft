package com.culinarycraft.auth;

import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.*;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwords() { return new BCryptPasswordEncoder(12); }
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication(type = org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type.SERVLET)
    SecurityFilterChain security(HttpSecurity http, TokenService tokens, AuthenticationLimits limits,
        com.culinarycraft.persistence.DemoUserRepository users,
        @org.springframework.beans.factory.annotation.Value("${COOKIE_SECURE:true}") boolean secure) throws Exception {
        var csrfCookies = new CookieCsrfTokenRepository();
        csrfCookies.setCookieCustomizer(cookie -> cookie.secure(secure).sameSite("Strict").httpOnly(true));
        org.springframework.security.authorization.AuthorizationManager<org.springframework.security.web.access.intercept.RequestAuthorizationContext> verified = (authentication, context) -> {
            var principal = authentication.get().getPrincipal();
            boolean allowed = principal instanceof org.springframework.security.oauth2.jwt.Jwt jwt
                && users.findById(Long.parseLong(jwt.getSubject())).map(com.culinarycraft.persistence.DemoUserEntity::isEmailVerified).orElse(false);
            return new org.springframework.security.authorization.AuthorizationDecision(allowed);
        };
        var filter = new org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter(
            new org.springframework.security.authentication.ProviderManager(
                new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider(tokens)));
        filter.setBearerTokenResolver(request -> {
            if (request.getRequestURI().startsWith("/api/auth/") && !java.util.Set.of("/api/auth/me", "/api/auth/logout").contains(request.getRequestURI())) return null;
            if (request.getCookies() == null) return null;
            for (var cookie : request.getCookies()) if (cookie.getName().equals("cc-session")) return cookie.getValue();
            return null;
        });
        filter.setAuthenticationFailureHandler((request, response, error) -> {
            response.addHeader("Set-Cookie", "cc-session=; Path=/api; Max-Age=0; HttpOnly; SameSite=Strict" + (secure ? "; Secure" : ""));
            response.setStatus(401);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Session expired, please sign in again\"}");
        });
        http.cors(cors -> cors.configurationSource(request -> {
            var config = new CorsConfiguration();
            config.setAllowedOrigins(java.util.List.of("http://127.0.0.1:5173", "http://localhost:5173"));
            config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
            config.setAllowedHeaders(java.util.List.of("Content-Type", "X-XSRF-TOKEN"));
            config.setAllowCredentials(true); return config;
        })).sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.csrfTokenRepository(csrfCookies))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/recipes/**", "/api/reports").access(verified)
                .requestMatchers(HttpMethod.PUT, "/api/recipes/**").access(verified)
                .requestMatchers(HttpMethod.DELETE, "/api/recipes/**").access(verified)
                .requestMatchers("/api/admin/**", "/api/reports/**", "/api/account/**").authenticated()
                .requestMatchers("/api/auth/me", "/api/auth/logout", "/api/recipes/mine", "/api/recipes/favorites", "/api/recipes/pending").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                .requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/verification/**", "/api/auth/password/**").permitAll()
                .anyRequest().authenticated())
            .exceptionHandling(errors -> errors.accessDeniedHandler((req, res, ex) -> {
                res.setStatus(403); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Access denied or invalid CSRF token\"}");
            }).authenticationEntryPoint((req, res, ex) -> {
                res.setStatus(401); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Authentication required\"}");
            }))
            .addFilterBefore(filter, org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new AuthenticationLimitFilter(limits), org.springframework.security.web.csrf.CsrfFilter.class);
        return http.build();
    }
}
