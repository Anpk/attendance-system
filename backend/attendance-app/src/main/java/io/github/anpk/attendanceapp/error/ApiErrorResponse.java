package io.github.anpk.attendanceapp.error;

import java.time.Instant;

public class ApiErrorResponse {
    private final String code;
    private final String message;
    private final Instant timestamp;

    public ApiErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
        this.timestamp = Instant.now();
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public Instant getTimestamp() {
        return timestamp;
    }
}