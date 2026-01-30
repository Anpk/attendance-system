package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;

import java.time.OffsetDateTime;

/**
 * 승인/반려 처리 응답(최소 공통)
 */
public record CorrectionRequestProcessResponse(
        Long requestId,
        CorrectionRequestStatus status,
        OffsetDateTime processedAt,
        Long processedBy,
        String comment,
        String reason
) {}