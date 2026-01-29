package io.github.anpk.attendanceapp.correction.interfaces.dto;

import java.util.List;

public record CorrectionRequestListResponse(
        List<CorrectionRequestResponse> items,
        int page,
        int size,
        long totalElements
) {}