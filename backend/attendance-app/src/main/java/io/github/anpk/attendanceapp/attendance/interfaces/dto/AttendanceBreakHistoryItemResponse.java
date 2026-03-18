package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.time.OffsetDateTime;

public record AttendanceBreakHistoryItemResponse(
        OffsetDateTime breakStartAt,
        OffsetDateTime breakEndAt,
        long breakMinutes
) {}
