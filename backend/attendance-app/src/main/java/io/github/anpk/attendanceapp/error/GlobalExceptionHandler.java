package io.github.anpk.attendanceapp.error;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import java.time.OffsetDateTime;
import java.time.ZoneId;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // dev 프로필에서만 예외 요약을 message에 포함(표준 6필드 유지)
    @Value("${app.error.include-exception-details:false}")
    private boolean includeExceptionDetails;

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
    // multipart/form-data가 필요한 요청인데 Content-Type이 없거나 지원하지 않는 타입인 경우 (기존 415 → 계약상 422로 정렬)
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException e, HttpServletRequest request) {
        HttpStatus status = ErrorCodeHttpMapper.toStatus(ErrorCode.INVALID_REQUEST_PAYLOAD);
        ApiErrorResponse body = new ApiErrorResponse(
            OffsetDateTime.now(KST).toString(),
            status.value(),
            status.name(),
            ErrorCode.INVALID_REQUEST_PAYLOAD.name(),
            "요청 형식이 올바르지 않습니다.",
            request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    // multipart는 맞지만 특정 파트(photo)가 누락된 경우 (계약상 422)
    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingPart(MissingServletRequestPartException e, HttpServletRequest request) {
        HttpStatus status = ErrorCodeHttpMapper.toStatus(ErrorCode.INVALID_REQUEST_PAYLOAD);
        ApiErrorResponse body = new ApiErrorResponse(
            OffsetDateTime.now(KST).toString(),
            status.value(),
            status.name(),
            ErrorCode.INVALID_REQUEST_PAYLOAD.name(),
            "출근 사진은 필수입니다.",
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
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e, HttpServletRequest request) {        HttpStatus status = HttpStatus.BAD_REQUEST;
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

    /**
     * 업로드 크기 제한 초과 (컨트롤러 진입 전 발생 가능)
     * Contract 관점: 요청 payload 오류 → INVALID_REQUEST_PAYLOAD(422) + 표준 6필드
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException e, HttpServletRequest request) {
        HttpStatus status = ErrorCodeHttpMapper.toStatus(ErrorCode.INVALID_REQUEST_PAYLOAD);
        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                ErrorCode.INVALID_REQUEST_PAYLOAD.name(),
                "파일 크기가 너무 큽니다. (최대 5MB)",
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    /**
     * 멀티파트 파싱 단계에서의 일반 오류도 Contract 응답으로 정렬
     */
    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiErrorResponse> handleMultipart(MultipartException e, HttpServletRequest request) {
        HttpStatus status = ErrorCodeHttpMapper.toStatus(ErrorCode.INVALID_REQUEST_PAYLOAD);
        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(KST).toString(),
                status.value(),
                status.name(),
                ErrorCode.INVALID_REQUEST_PAYLOAD.name(),
                "요청 형식이 올바르지 않습니다.",
                request.getRequestURI()
        );
        return ResponseEntity.status(status).body(body);
    }

    // 유효성 검증 오류 (422) - @Valid 등을 붙였을 때
    @ExceptionHandler(MethodArgumentNotValidException.class)
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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception e, HttpServletRequest request) {
        // 응답에는 trace를 절대 포함하지 않고, 로그에만 남긴다.
        log.error("Unhandled exception", e);

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        String message = "서버 내부 오류가 발생했습니다.";
        if (includeExceptionDetails) {
            // dev에서만 예외 요약을 message에 포함(표준 6필드 유지)
            String detail = e.getMessage() == null ? "" : e.getMessage();
            message = e.getClass().getSimpleName() + (detail.isBlank() ? "" : (": " + detail));
        }

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

