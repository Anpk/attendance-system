package io.github.anpk.attendanceapp.error;

import org.springframework.http.HttpStatus;

import java.util.EnumMap;
import java.util.Map;

public final class ErrorCodeHttpMapper {

    private static final Map<ErrorCode, HttpStatus> MAP = new EnumMap<>(ErrorCode.class);

    static {
        // Attendance
        MAP.put(ErrorCode.ATTENDANCE_NOT_FOUND, HttpStatus.NOT_FOUND);
        MAP.put(ErrorCode.ALREADY_CHECKED_IN, HttpStatus.CONFLICT);
        MAP.put(ErrorCode.NOT_CHECKED_IN, HttpStatus.CONFLICT);
        MAP.put(ErrorCode.ALREADY_CHECKED_OUT, HttpStatus.CONFLICT);
        MAP.put(ErrorCode.OPEN_ATTENDANCE_EXISTS, HttpStatus.CONFLICT);
        MAP.put(ErrorCode.EMPLOYEE_INACTIVE, HttpStatus.FORBIDDEN);

        // Correction
        MAP.put(ErrorCode.CORRECTION_REQUEST_NOT_FOUND, HttpStatus.NOT_FOUND);
        MAP.put(ErrorCode.PENDING_REQUEST_EXISTS, HttpStatus.CONFLICT);
        MAP.put(ErrorCode.OUT_OF_CORRECTION_WINDOW, HttpStatus.UNPROCESSABLE_ENTITY);
        MAP.put(ErrorCode.INVALID_TIME_ORDER, HttpStatus.UNPROCESSABLE_ENTITY);
        MAP.put(ErrorCode.EXCEEDS_MAX_WORK_DURATION, HttpStatus.UNPROCESSABLE_ENTITY);
        MAP.put(ErrorCode.INVALID_STATUS_TRANSITION, HttpStatus.CONFLICT);

        // Policy/Admin
        MAP.put(ErrorCode.POLICY_ALREADY_EXISTS, HttpStatus.CONFLICT);
        MAP.put(ErrorCode.POLICY_NOT_FOUND, HttpStatus.NOT_FOUND);
        MAP.put(ErrorCode.SITE_INACTIVE, HttpStatus.FORBIDDEN);
        MAP.put(ErrorCode.EMPLOYEE_NOT_FOUND, HttpStatus.NOT_FOUND);

        // Auth
        MAP.put(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
        MAP.put(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);

        // Request Binding / Validation (Contract)
        MAP.put(ErrorCode.MISSING_REQUIRED_PARAM, HttpStatus.BAD_REQUEST);
        MAP.put(ErrorCode.INVALID_REQUEST_PARAM, HttpStatus.BAD_REQUEST);
        MAP.put(ErrorCode.INVALID_REQUEST_PAYLOAD, HttpStatus.UNPROCESSABLE_ENTITY);
        MAP.put(ErrorCode.INVALID_MONTH_FORMAT, HttpStatus.UNPROCESSABLE_ENTITY);

        // Framework / Endpoint
        MAP.put(ErrorCode.ENDPOINT_NOT_FOUND, HttpStatus.NOT_FOUND);

        // Internal
        MAP.put(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ErrorCodeHttpMapper() {}

    public static HttpStatus toStatus(ErrorCode code) {
        // enum이므로 unknown은 원칙적으로 불가능하지만,
        // mapping 누락 방지를 위해 null 가능성은 남겨둔다.
        return MAP.get(code);
    }
}
