package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import java.util.List;

public record AttendanceListResponse(
        List<AttendanceListItemResponse> items,
        int page,
        int size,
        long totalElements

) {}
