package io.github.anpk.attendance.controller.dto;

public record TodayAttendanceResponse(
        boolean checkedIn,
        boolean checkedOut,
        String checkInTime,
        String checkOutTime
) {}