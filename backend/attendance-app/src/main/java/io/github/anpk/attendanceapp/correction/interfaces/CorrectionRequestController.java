package io.github.anpk.attendanceapp.correction.interfaces;

import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.correction.application.service.CorrectionRequestService;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestCancelResponse;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestCreateRequest;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestListResponse;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 정정 요청 API (MVP 1차)
 * - 생성 / 내 요청 목록(requested_by_me)만 우선 제공
 */
@RestController
@RequestMapping("/api")
public class CorrectionRequestController {

    private final CorrectionRequestService correctionRequestService;

    public CorrectionRequestController(CorrectionRequestService correctionRequestService) {
        this.correctionRequestService = correctionRequestService;
    }

    @PostMapping("/attendance/{attendanceId}/correction-requests")
    public ResponseEntity<CorrectionRequestResponse> create(
            @CurrentUserId Long userId,
            @PathVariable Long attendanceId,
            @RequestBody CorrectionRequestCreateRequest request
    ) {
        var body = correctionRequestService.create(userId, attendanceId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/correction-requests")
    public CorrectionRequestListResponse list(
            @CurrentUserId Long userId,
            @RequestParam String scope,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return correctionRequestService.list(userId, scope, status, page, size);
    }

    /**
     * 정정 요청 취소
     * - POST /api/correction-requests/{requestId}/cancel
     * - PENDING만 / 요청자 본인만
     */
    @PostMapping("/correction-requests/{requestId}/cancel")
    public CorrectionRequestCancelResponse cancel(
            @CurrentUserId Long userId,
            @PathVariable Long requestId
    ) {
        return correctionRequestService.cancel(userId, requestId);
    }
}