package io.github.anpk.attendanceapp.correction.interfaces.dto;

import java.time.OffsetDateTime;

public record CorrectionRequestBreakProposalRequest(
        OffsetDateTime proposedBreakStartAt,
        OffsetDateTime proposedBreakEndAt
) {}
