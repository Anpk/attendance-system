package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;

import java.time.OffsetDateTime;
import java.time.ZoneId;

public record AttendanceActionResponse(
        Long attendanceId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        boolean isCorrected
) {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    public static AttendanceActionResponse from(Attendance a) {
        var in = (a.getCheckInTime() == null) ? null : a.getCheckInTime().atZone(KST).toOffsetDateTime();
        var out = (a.getCheckOutTime() == null) ? null : a.getCheckOutTime().atZone(KST).toOffsetDateTime();

        return new AttendanceActionResponse(
                a.getId(),
                a.getWorkDate().toString(),
                in,
                out,
                false
        );
    }
}
