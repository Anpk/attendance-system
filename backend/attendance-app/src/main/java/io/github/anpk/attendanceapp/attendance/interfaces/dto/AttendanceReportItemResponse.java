package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record AttendanceReportItemResponse(
        Long attendanceId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        long breakMinutes,
        List<AttendanceBreakHistoryItemResponse> breakHistory,
        Long workMinutes,
        boolean isCorrected
) {}
