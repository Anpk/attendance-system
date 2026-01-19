package io.github.anpk.attendanceapp.controller.dto;

public record TodayAttendanceResponse(
        boolean checkedIn,
        boolean checkedOut,
        String checkInTime,
        String checkOutTime
) {}