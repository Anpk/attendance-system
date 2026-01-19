package io.github.anpk.attendanceapp.attendance.interfaces.dto;

public record AttendanceResponse(
        boolean checkedIn,
        boolean checkedOut,
        String checkInTime,
        String checkOutTime
) {}