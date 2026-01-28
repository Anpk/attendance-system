package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;

import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Attendance 목록 아이템 DTO
 * - Contract: 목록도 Final 값만 반환
 */
public record AttendanceListItemResponse(
        Long attendanceId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        boolean isCorrected
) {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    public static AttendanceListItemResponse from(Attendance a) {
        var in = (a.getCheckInTime() == null) ? null : a.getCheckInTime().atZone(KST).toOffsetDateTime();
        var out = (a.getCheckOutTime() == null) ? null : a.getCheckOutTime().atZone(KST).toOffsetDateTime();
        return new AttendanceListItemResponse(
                a.getId(),
                a.getWorkDate().toString(),
                in,
                out,
                false // TODO(contract): 승인된 정정 존재 시 true
        );
    }
}
