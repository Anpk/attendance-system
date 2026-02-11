package io.github.anpk.attendanceapp.auth.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * ✅ Authorization: Bearer <jwt> -> request attribute로 userId 주입
 * - 토큰이 없거나 무효면 조용히 패스하고, @CurrentUserId resolver가 401 처리
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String REQ_ATTR_USER_ID = "AUTH_USER_ID";

    private final JwtTokenService jwtTokenService;

    public JwtAuthFilter(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring("Bearer ".length()).trim();
            jwtTokenService.parseUserIdIfValid(token)
                    .ifPresent(userId -> request.setAttribute(REQ_ATTR_USER_ID, userId));
        }
        filterChain.doFilter(request, response);
    }
}