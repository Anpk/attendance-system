package io.github.anpk.attendanceapp.error;

import java.util.Objects;

public class BusinessException extends RuntimeException {
    private final ErrorCode code;

    public BusinessException(ErrorCode code, String message) {
        super(message);
        this.code = Objects.requireNonNull(code, "code must not be null");
    }

    /** Backward compatibility for places expecting string. */
    public String getCode() {
        return code.name();
    }

    public ErrorCode getErrorCode() {
        return code;
    }
}
