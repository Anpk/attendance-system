package io.github.anpk.attendanceapp.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.time.ZoneId;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleBusiness(BusinessException e, HttpServletRequest request) {
        ErrorCode code = e.getErrorCode();
        HttpStatus status = ErrorCodeHttpMapper.toStatus(code);

        if (status == null) {
            return buildInternalError(request, "서버 내부 오류가 발생했습니다.");
        }

        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                code.name(),
                e.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException e, HttpServletRequest request) {
        // validation 전용 code를 계약으로 확정하기 전까지는 임시 처리 필요.
        // (가장 깔끔한 해법은 ErrorCode에 INVALID_REQUEST_PAYLOAD 등 추가 + 문서 반영)
        HttpStatus status = HttpStatus.UNPROCESSABLE_ENTITY;

        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                ErrorCode.INTERNAL_ERROR.name(),
                "요청 값이 올바르지 않습니다.",
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception e, HttpServletRequest request) {
        return buildInternalError(request, "서버 내부 오류가 발생했습니다.");
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

