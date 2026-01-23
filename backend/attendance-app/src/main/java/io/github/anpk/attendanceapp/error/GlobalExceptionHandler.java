package io.github.anpk.attendanceapp.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

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

