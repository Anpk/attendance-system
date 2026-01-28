package io.github.anpk.attendanceapp.error;

/**
 * Contract-defined business error codes.
 * NOTE: Do not add codes without updating spec/docs and error-mapping.
 */
public enum ErrorCode {
    ENDPOINT_NOT_FOUND,

    // Request Binding / Validation (Contract)
    MISSING_REQUIRED_PARAM,
    INVALID_REQUEST_PARAM,
    INVALID_REQUEST_PAYLOAD,

    // Attendance
    ATTENDANCE_NOT_FOUND,
    ALREADY_CHECKED_IN,
    NOT_CHECKED_IN,
    ALREADY_CHECKED_OUT,
    OPEN_ATTENDANCE_EXISTS,
    EMPLOYEE_INACTIVE,

    // Correction Request
    PENDING_REQUEST_EXISTS,
    OUT_OF_CORRECTION_WINDOW,
    INVALID_TIME_ORDER,
    EXCEEDS_MAX_WORK_DURATION,
    INVALID_STATUS_TRANSITION,

    // Policy / Admin
    POLICY_ALREADY_EXISTS,
    POLICY_NOT_FOUND,
    SITE_INACTIVE,
    EMPLOYEE_NOT_FOUND,

    // Common / Auth
    UNAUTHORIZED,
    FORBIDDEN,

    // Internal
    INTERNAL_ERROR
}
