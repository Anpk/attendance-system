package io.github.anpk.attendanceapp.error;

public class ApiErrorResponse {
    private final String timestamp; // ISO-8601 with Asia/Seoul offset
    private final int status;       // HTTP status code
    private final String error;     // HTTP status name (e.g., CONFLICT)
    private final String code;      // business error code
    private final String message;   // debug/log message
    private final String path;      // request URI

    public ApiErrorResponse(
            String timestamp,
            int status,
            String error,
            String code,
            String message,
            String path
    ) {
        this.timestamp = timestamp;
        this.status = status;
        this.error = error;
        this.code = code;
        this.message = message;
        this.path = path;
    }

    public String getTimestamp() { return timestamp; }
    public int getStatus() { return status; }
    public String getError() { return error; }
    public String getCode() { return code; }
    public String getMessage() { return message; }
    public String getPath() { return path; }
}
