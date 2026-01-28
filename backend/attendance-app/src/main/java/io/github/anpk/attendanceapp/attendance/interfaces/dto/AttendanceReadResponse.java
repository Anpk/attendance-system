package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;

import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Attendance 단건 조회 응답 DTO
 * - Contract: 조회는 Final 값을 반환(정정 승인 반영)하되, 지금은 정정 미구현이므로 원본=Final로 반환한다.
 */
public record AttendanceReadResponse(
        Long attendanceId,
        Long employeeId,
        Long siteId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        boolean isCorrected,
        Long appliedCorrectionRequestId
) {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    public static AttendanceReadResponse from(Attendance a, Long employeeId) {
        var in = (a.getCheckInTime() == null) ? null : a.getCheckInTime().atZone(KST).toOffsetDateTime();
        var out = (a.getCheckOutTime() == null) ? null : a.getCheckOutTime().atZone(KST).toOffsetDateTime();

        return new AttendanceReadResponse(
                a.getId(),
                employeeId,
                null, // TODO(contract): Site/Employee 모델 도입 시 채움
                a.getWorkDate().toString(),
                in,
                out,
                false, // TODO(contract): 승인된 정정 존재 시 true
                null   // TODO(contract): 승인된 정정 requestId
        );
    }
}
