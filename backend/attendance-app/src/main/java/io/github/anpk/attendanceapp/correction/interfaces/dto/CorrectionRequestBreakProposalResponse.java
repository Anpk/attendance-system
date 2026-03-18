package io.github.anpk.attendanceapp.correction.interfaces.dto;

import java.time.OffsetDateTime;

public record CorrectionRequestBreakProposalResponse(
        Integer sortOrder,
        OffsetDateTime proposedBreakStartAt,
        OffsetDateTime proposedBreakEndAt,
        Long breakMinutes
) {}
