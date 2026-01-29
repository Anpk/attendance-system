package io.github.anpk.attendanceapp.correction.domain.model;

/**
 * 정정 요청 상태
 * - Contract: PENDING → APPROVED/REJECTED/CANCELED 만 허용
 */
public enum CorrectionRequestStatus {
    PENDING,
    APPROVED,
    REJECTED,
    CANCELED
}