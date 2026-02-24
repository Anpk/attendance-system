package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.util.List;

public record AttendanceReportResponse(
        String from,
        String to,
        int totalDays,
        long totalWorkMinutes,
        List<AttendanceReportItemResponse> items
) {}