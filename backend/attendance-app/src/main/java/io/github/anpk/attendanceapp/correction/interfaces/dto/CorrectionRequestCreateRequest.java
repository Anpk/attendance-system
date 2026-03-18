package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 정정 요청 생성 요청 DTO
 * - type은 선택(미입력 시 proposed 값으로 추론)
 */
public record CorrectionRequestCreateRequest(
        Long requestId,
        Long attendanceId,
        CorrectionRequestStatus status,
        CorrectionRequestType type,
        Long requestedBy,
        OffsetDateTime requestedAt,
        OffsetDateTime proposedCheckInAt,
        OffsetDateTime proposedCheckOutAt,
        List<CorrectionRequestBreakProposalRequest> proposedBreaks,
        String reason
) {}
