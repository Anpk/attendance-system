package io.github.anpk.attendanceapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.split(","))
                // ✅ ngrok 외부 테스트 허용(도메인 미보유 시)
                // - allowedOrigins는 와일드카드를 지원하지 않으므로 패턴 기반 허용을 추가한다.
                // - Authorization(Bearer) 기반이므로 allowCredentials(false) 유지 가능
                .allowedOriginPatterns(
                        "https://*.ngrok-free.dev",
                        "https://*.ngrok-free.app"
                )
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false);
    }
}