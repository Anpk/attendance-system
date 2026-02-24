package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.time.OffsetDateTime;

public record AdminAttendanceReportItemResponse(
        Long attendanceId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        Long workMinutes,
        boolean isCorrected
) {}