package io.github.anpk.attendanceapp.correction.interfaces.dto;

/**
 * 반려 요청 바디
 * - reason 필수(서비스에서 blank 검증)
 */
public record CorrectionRequestRejectRequest(
        String reason
) {}