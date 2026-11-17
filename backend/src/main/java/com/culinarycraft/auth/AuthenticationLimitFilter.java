package com.culinarycraft.auth;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

public class AuthenticationLimitFilter extends OncePerRequestFilter {
    private final AuthenticationLimits limits;
    public AuthenticationLimitFilter(AuthenticationLimits limits) { this.limits = limits; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String path = request.getRequestURI();
        if ("POST".equals(request.getMethod()) && Set.of("/api/auth/login", "/api/auth/register").contains(path)
            && !limits.allow(path, request.getRemoteAddr(), path.endsWith("login") ? 30 : 10, 600)) {
            response.setStatus(429); response.setHeader("Retry-After", "600");
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Слишком много попыток. Повторите через 10 минут\"}");
            return;
        }
        // Forwarded headers are deliberately not trusted as a client identity.
        chain.doFilter(request, response);
    }
}
