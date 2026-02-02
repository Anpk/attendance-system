package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;

import java.time.OffsetDateTime;

public record CorrectionRequestResponse(
        Long requestId,
        Long attendanceId,
        CorrectionRequestStatus status,
        CorrectionRequestType type,
        Long requestedBy,
        OffsetDateTime requestedAt,
        OffsetDateTime proposedCheckInAt,
        OffsetDateTime proposedCheckOutAt,
        String reason
) {}