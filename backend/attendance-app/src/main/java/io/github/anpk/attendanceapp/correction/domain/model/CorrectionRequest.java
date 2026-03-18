package io.github.anpk.attendanceapp.correction.domain.model;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;
import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 정정 요청 엔티티 (MVP 1차: 생성/내 요청 목록까지만 사용)
 */
@Entity
@Table(name = "correction_requests")
public class CorrectionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attendance_id", nullable = false)
    private Attendance attendance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CorrectionRequestStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CorrectionRequestType type;

    @Column(name = "requested_by", nullable = false)
    private Long requestedBy;

    @Column(name = "requested_at", nullable = false)
    private OffsetDateTime requestedAt;

    @Column(name = "proposed_check_in_at")
    private OffsetDateTime proposedCheckInAt;

    @Column(name = "proposed_check_out_at")
    private OffsetDateTime proposedCheckOutAt;

    @Column(name = "break_change_requested", nullable = false)
    private boolean breakChangeRequested;

    @OneToMany(mappedBy = "correctionRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<CorrectionRequestBreakProposal> proposedBreaks = new ArrayList<>();

    @Column(name = "canceled_at")
    private OffsetDateTime canceledAt;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    @Column(name = "processed_by")
    private Long processedBy;

    @Column(name = "approve_comment", columnDefinition = "TEXT")
    private String approveComment;

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    protected CorrectionRequest() {}

    public static CorrectionRequest pending(
            Attendance attendance,
            Long requestedBy,
            OffsetDateTime requestedAt,
            CorrectionRequestType type,
            OffsetDateTime proposedCheckInAt,
            OffsetDateTime proposedCheckOutAt,
            boolean breakChangeRequested,
            String reason
    ) {
        CorrectionRequest r = new CorrectionRequest();
        r.attendance = attendance;
        r.requestedBy = requestedBy;
        r.requestedAt = requestedAt;
        r.status = CorrectionRequestStatus.PENDING;
        r.type = type;
        r.proposedCheckInAt = proposedCheckInAt;
        r.proposedCheckOutAt = proposedCheckOutAt;
        r.breakChangeRequested = breakChangeRequested;
        r.reason = reason;
        return r;
    }

    public void addProposedBreak(int sortOrder, OffsetDateTime startAt, OffsetDateTime endAt) {
        this.proposedBreaks.add(
                CorrectionRequestBreakProposal.of(this, sortOrder, startAt, endAt)
        );
    }

    public Long getId() { return id; }
    public Attendance getAttendance() { return attendance; }
    public CorrectionRequestStatus getStatus() { return status; }
    public CorrectionRequestType getType() { return type; }
    public Long getRequestedBy() { return requestedBy; }
    public OffsetDateTime getRequestedAt() { return requestedAt; }
    public OffsetDateTime getProposedCheckInAt() { return proposedCheckInAt; }
    public OffsetDateTime getProposedCheckOutAt() { return proposedCheckOutAt; }
    public boolean isBreakChangeRequested() { return breakChangeRequested; }
    public List<CorrectionRequestBreakProposal> getProposedBreaks() { return proposedBreaks; }
    public OffsetDateTime getCanceledAt() { return canceledAt; }
    public OffsetDateTime getProcessedAt() { return processedAt; }
    public Long getProcessedBy() { return processedBy; }
    public String getApproveComment() { return approveComment; }
    public String getRejectReason() { return rejectReason; }
    public String getReason() { return reason; }

    /**
     * 정정 요청 취소
     * - Contract: PENDING -> CANCELED만 허용
     */
    public void cancel(OffsetDateTime canceledAt) {
        this.status = CorrectionRequestStatus.CANCELED;
        this.canceledAt = canceledAt;
    }

    /**
     * 정정 요청 승인 처리
     * - 상태 전이 검증은 서비스에서 수행(최소 diff)
     */
    public void approve(Long approverUserId, OffsetDateTime processedAt, String comment) {
        this.status = CorrectionRequestStatus.APPROVED;
        this.processedBy = approverUserId;
        this.processedAt = processedAt;
        this.approveComment = comment;
        this.rejectReason = null;
    }

    /**
     * 정정 요청 반려 처리
     * - 상태 전이/필수값 검증은 서비스에서 수행(최소 diff)
     */
    public void reject(Long approverUserId, OffsetDateTime processedAt, String rejectReason) {
        this.status = CorrectionRequestStatus.REJECTED;
        this.processedBy = approverUserId;
        this.processedAt = processedAt;
        this.rejectReason = rejectReason;
        this.approveComment = null;
    }
}
