package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.util.List;

public record AdminAttendanceReportEmployeeResponse(
        Long userId,
        String username,
        String role,
        boolean active,
        Long siteId,
        int totalDays,
        long totalWorkMinutes,
        int missingCheckoutCount,
        int correctedCount,
        List<AdminAttendanceReportItemResponse> items
) {}