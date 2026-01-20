package io.github.anpk.attendanceapp.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.OffsetDateTime;
import java.time.ZoneId;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleBusiness(BusinessException e, HttpServletRequest request) {
        HttpStatus status = ErrorCodeHttpMapper.toStatus(e.getErrorCode());
        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                e.getErrorCode().name(),
                e.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    // 필수 파라미터 누락 (400)
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParam(MissingServletRequestParameterException e, HttpServletRequest request) {
            HttpStatus status = HttpStatus.BAD_REQUEST;
            ApiErrorResponse body = new ApiErrorResponse(
                    OffsetDateTime.now(KST).toString(),
                    status.value(),
                    status.name(),
                    ErrorCode.MISSING_REQUIRED_PARAM.name(),
                    "필수 파라미터가 누락되었습니다.",
                    request.getRequestURI()
            );
            return ResponseEntity.status(status).body(body);
    }

    // 파라미터 타입/포맷 불일치 (400)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e, HttpServletRequest request) {
            HttpStatus status = HttpStatus.BAD_REQUEST;
            ApiErrorResponse body = new ApiErrorResponse(
                    OffsetDateTime.now(KST).toString(),
                    status.value(),
                    status.name(),
                    ErrorCode.INVALID_REQUEST_PARAM.name(),
                    "요청 파라미터 형식이 올바르지 않습니다.",
                    request.getRequestURI()
            );
            return ResponseEntity.status(status).body(body);
    }

    // 유효성 검증 오류 (422) - @Valid 등을 붙였을 때
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException e, HttpServletRequest request) {
            HttpStatus status = HttpStatus.UNPROCESSABLE_ENTITY;
            ApiErrorResponse body = new ApiErrorResponse(
                            OffsetDateTime.now(KST).toString(),
                            status.value(),
                            status.name(),
                            ErrorCode.INVALID_REQUEST_PAYLOAD.name(),
                            "요청 값이 올바르지 않습니다.",
                            request.getRequestURI()
                            );
            return ResponseEntity.status(status).body(body);
            }

    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception e, HttpServletRequest request) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                ErrorCode.INTERNAL_ERROR.name(),
                "서버 내부 오류가 발생했습니다.",
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    private ResponseEntity<ApiErrorResponse> buildInternalError(HttpServletRequest request, String message) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;

        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                ErrorCode.INTERNAL_ERROR.name(),
                message,
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }
}

