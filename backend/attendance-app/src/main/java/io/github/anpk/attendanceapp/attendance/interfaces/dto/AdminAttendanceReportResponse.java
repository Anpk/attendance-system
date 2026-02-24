package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.util.List;

public record AdminAttendanceReportResponse(
        Long siteId,
        String from,
        String to,
        int totalEmployees,
        List<AdminAttendanceReportEmployeeResponse> employees
) {}