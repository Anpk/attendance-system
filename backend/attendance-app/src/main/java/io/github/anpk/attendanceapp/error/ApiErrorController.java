package io.github.anpk.attendanceapp.error;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.time.ZoneId;

@RestController
public class ApiErrorController implements ErrorController {

    private static final Logger log = LoggerFactory.getLogger(ApiErrorController.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /**
     * Spring 기본 에러(/error) 응답을 계약(6필드)으로 강제한다.
     * - trace 등 추가 필드 노출 방지
     * - code 필드 항상 포함
     */
    @RequestMapping("${server.error.path:/error}")
    public ResponseEntity<ApiErrorResponse> handleError(HttpServletRequest request) {
        int statusCode = getStatusCode(request);
        HttpStatus status = safeHttpStatus(statusCode);

        String path = (String) request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        if (path == null || path.isBlank()) {
            path = request.getRequestURI();
        }

        Throwable ex = (Throwable) request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
        if (ex != null) {
            // 응답에 trace는 절대 포함하지 않고 로그에만 남긴다.
            log.error("Unhandled exception routed to /error", ex);
        }

        ErrorCode code = mapToErrorCode(statusCode);
        String message = defaultMessage(statusCode);

        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                code.name(),
                message,
                path
        );
        return ResponseEntity.status(status).body(body);
    }

    private int getStatusCode(HttpServletRequest request) {
        Object value = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (value == null) return 500;
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ignored) {
            return 500;
        }
    }

    private HttpStatus safeHttpStatus(int statusCode) {
        try {
            return HttpStatus.valueOf(statusCode);
        } catch (Exception ignored) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
    }

    private ErrorCode mapToErrorCode(int statusCode) {
        // 런타임(프레임워크) 에러도 code 필드를 반드시 포함한다.
        return switch (statusCode) {
            case 400, 405 -> ErrorCode.INVALID_REQUEST_PARAM;
            case 401 -> ErrorCode.UNAUTHORIZED;
            case 403 -> ErrorCode.FORBIDDEN;
            case 404 -> ErrorCode.ENDPOINT_NOT_FOUND;
            case 415, 422 -> ErrorCode.INVALID_REQUEST_PAYLOAD;
            default -> ErrorCode.INTERNAL_ERROR;
        };
    }

    private String defaultMessage(int statusCode) {
        // message는 디버그/로그 목적(클라이언트 분기 기준 아님)
        return switch (statusCode) {
            case 404 -> "요청한 API를 찾을 수 없습니다.";
            case 415 -> "지원하지 않는 Content-Type 입니다.";
            case 405 -> "지원하지 않는 HTTP Method 입니다.";
            case 400 -> "잘못된 요청입니다.";
            default -> "서버 내부 오류가 발생했습니다.";
        };
    }
}