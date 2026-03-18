package io.github.anpk.attendanceapp.correction.domain.model;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "correction_request_break_proposals")
public class CorrectionRequestBreakProposal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "correction_request_id", nullable = false)
    private CorrectionRequest correctionRequest;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "proposed_break_start_at", nullable = false)
    private OffsetDateTime proposedBreakStartAt;

    @Column(name = "proposed_break_end_at", nullable = false)
    private OffsetDateTime proposedBreakEndAt;

    protected CorrectionRequestBreakProposal() {}

    public static CorrectionRequestBreakProposal of(
            CorrectionRequest correctionRequest,
            int sortOrder,
            OffsetDateTime proposedBreakStartAt,
            OffsetDateTime proposedBreakEndAt
    ) {
        CorrectionRequestBreakProposal p = new CorrectionRequestBreakProposal();
        p.correctionRequest = correctionRequest;
        p.sortOrder = sortOrder;
        p.proposedBreakStartAt = proposedBreakStartAt;
        p.proposedBreakEndAt = proposedBreakEndAt;
        return p;
    }

    public Long getId() {
        return id;
    }

    public CorrectionRequest getCorrectionRequest() {
        return correctionRequest;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public OffsetDateTime getProposedBreakStartAt() {
        return proposedBreakStartAt;
    }

    public OffsetDateTime getProposedBreakEndAt() {
        return proposedBreakEndAt;
    }
}
