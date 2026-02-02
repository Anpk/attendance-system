package io.github.anpk.attendanceapp.attendance.interfaces.dto;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;

import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Attendance 목록 아이템 DTO
 * - Contract: 목록도 Final 값만 반환
 * - isCorrected: 승인된 정정 1건이 합성되어 Final 값이 원본과 달라졌는지 여부(서비스에서 판정)
 */
public record AttendanceListItemResponse(
        Long attendanceId,
        String workDate,
        OffsetDateTime checkInAt,
        OffsetDateTime checkOutAt,
        boolean isCorrected,
        boolean hasPendingCorrection
) {}
