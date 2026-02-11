package io.github.anpk.attendanceapp.auth.jwt;

import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * ✅ Spring Security 없이도 동작하는 "최소" JWT (HS256) 발급/검증
 * - payload: sub(userId), role, iat, exp
 */
@Service
public class JwtTokenService {

    private final String secret;
    private final long expiresSeconds;

    public JwtTokenService(
            @Value("${auth.jwt.secret}") String secret,
            @Value("${auth.jwt.expires-seconds}") long expiresSeconds
    ) {
        this.secret = secret;
        this.expiresSeconds = expiresSeconds;
    }

    public long getExpiresSeconds() {
        return expiresSeconds;
    }

    public String issueToken(long userId, EmployeeRole role) {
        String headerJson = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
        long now = Instant.now().getEpochSecond();
        long exp = now + expiresSeconds;
        String payloadJson = "{\"sub\":\"" + userId + "\",\"role\":\"" + role.name() + "\",\"iat\":" + now + ",\"exp\":" + exp + "}";

        String header = b64Url(headerJson.getBytes(StandardCharsets.UTF_8));
        String payload = b64Url(payloadJson.getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + payload;
        String sig = hmacSha256(signingInput, secret);
        return signingInput + "." + sig;
    }

    public Optional<Long> parseUserIdIfValid(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return Optional.empty();
            String signingInput = parts[0] + "." + parts[1];
            String expectedSig = hmacSha256(signingInput, secret);
            if (!constantTimeEquals(expectedSig, parts[2])) return Optional.empty();

            String payloadJson = new String(b64UrlDecode(parts[1]), StandardCharsets.UTF_8);
            Long sub = extractLongStringClaim(payloadJson, "sub");
            Long exp = extractLongNumberClaim(payloadJson, "exp");
            if (sub == null || exp == null) return Optional.empty();
            if (Instant.now().getEpochSecond() >= exp) return Optional.empty();
            return Optional.of(sub);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static String b64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] b64UrlDecode(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    private static String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return b64Url(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // 매우 단순한 파서(최소): {"sub":"999", ...} 형태만 대상으로 함
    private static Long extractLongStringClaim(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int i = json.indexOf(pattern);
        if (i < 0) return null;
        int start = i + pattern.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        try {
            return Long.parseLong(json.substring(start, end));
        } catch (Exception e) {
            return null;
        }
    }

    private static Long extractLongNumberClaim(String json, String key) {
        String pattern = "\"" + key + "\":";
        int i = json.indexOf(pattern);
        if (i < 0) return null;
        int start = i + pattern.length();
        int end = start;
        while (end < json.length() && Character.isDigit(json.charAt(end))) end++;
        try {
            return Long.parseLong(json.substring(start, end));
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int r = 0;
        for (int i = 0; i < a.length(); i++) r |= a.charAt(i) ^ b.charAt(i);
        return r == 0;
    }
}