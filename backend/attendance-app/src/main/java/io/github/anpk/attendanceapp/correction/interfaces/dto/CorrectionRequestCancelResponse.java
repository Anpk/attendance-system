package io.github.anpk.attendanceapp.correction.interfaces.dto;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;

import java.time.OffsetDateTime;

/**
 * 정정 요청 취소 응답
 * - docs/api/20-correction-requests.md의 Cancel 응답 형식에 맞춤
 */
public record CorrectionRequestCancelResponse(
        Long requestId,
        CorrectionRequestStatus status,
        OffsetDateTime canceledAt
) {}