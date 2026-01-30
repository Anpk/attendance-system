package io.github.anpk.attendanceapp.correction.interfaces.dto;

/**
 * 승인 요청 바디(선택)
 */
public record CorrectionRequestApproveRequest(
        String comment
) {}