package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;

import java.time.OffsetDateTime;

/**
 * 정정 요청 생성 요청 DTO
 * - type은 선택(미입력 시 proposed 값으로 추론)
 */
public record CorrectionRequestCreateRequest(
        CorrectionRequestType type,
        OffsetDateTime proposedCheckInAt,
        OffsetDateTime proposedCheckOutAt,
        String reason
) {}