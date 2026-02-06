package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;

import java.time.OffsetDateTime;

public record CorrectionRequestDetailResponse(
        Long requestId,
        Long attendanceId,
        CorrectionRequestStatus status,
        CorrectionRequestType type,
        Long requestedBy,
        OffsetDateTime requestedAt,
        OffsetDateTime proposedCheckInAt,
        OffsetDateTime proposedCheckOutAt,
        String reason,
        // ✅ 상세 보강 필드(제안 전/현재)
        OffsetDateTime originalCheckInAt,
        OffsetDateTime originalCheckOutAt,
        OffsetDateTime currentCheckInAt,
        OffsetDateTime currentCheckOutAt
) {}