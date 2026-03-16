package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record AttendanceActionResponse(
        Long attendanceId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        boolean isCorrected,
        boolean breakInProgress,
        long totalBreakMinutes,
        OffsetDateTime activeBreakStartedAt
) {
    public static AttendanceActionResponse empty(LocalDate workDate) {
        return new AttendanceActionResponse(
                null,
                workDate.toString(),
                null,
                null,
                false,
                false,
                0L,
                null
        );
    }
}
