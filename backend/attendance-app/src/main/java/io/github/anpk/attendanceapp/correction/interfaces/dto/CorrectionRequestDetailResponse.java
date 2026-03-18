package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;

import java.time.OffsetDateTime;
import java.util.List;

public record CorrectionRequestDetailResponse(
        Long requestId,
        Long attendanceId,
        CorrectionRequestStatus status,
        CorrectionRequestType type,
        Long requestedBy,
        String requestedByName,
        Long workerUserId,
        String workerName,
        OffsetDateTime requestedAt,
        OffsetDateTime proposedCheckInAt,
        OffsetDateTime proposedCheckOutAt,
        boolean breakChangeRequested,
        List<CorrectionRequestBreakProposalResponse> proposedBreaks,
        String reason,
        // ✅ 상세 보강 필드(제안 전/현재)
        OffsetDateTime originalCheckInAt,
        OffsetDateTime originalCheckOutAt,
        OffsetDateTime currentCheckInAt,
        OffsetDateTime currentCheckOutAt
) {}
