package io.github.anpk.attendanceapp.correction.interfaces;

import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.correction.application.service.CorrectionRequestService;
import io.github.anpk.attendanceapp.correction.interfaces.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.extern.slf4j.Slf4j;

/**
 * 정정 요청 API (MVP 1차)
 * - 생성 / 내 요청 목록(requested_by_me)만 우선 제공
 */
@RestController
@Slf4j
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
     * 정정 요청 상세 조회
     * - 프론트 상세(/corrections/{id}) 진입용
     * - scope 기반으로 최소 접근제어를 통일:
     *   - scope=requested_by_me: 요청자 본인만
     *   - scope=approvable: 승인 권한자만(+ 메이커-체커 동일 정책)
     *   - scope 미지정: (요청자 본인) OR (승인 권한자) 허용
     */
    @GetMapping("/correction-requests/{requestId}")
    public CorrectionRequestDetailResponse read(
            @CurrentUserId Long userId,
            @PathVariable Long requestId,
            @RequestParam(required = false) String scope
    ) {
        return correctionRequestService.read(userId, requestId, scope);
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

    /**
     * 정정 요청 승인
     * - PENDING만 가능 / MANAGER(동일 site) 또는 ADMIN / 메이커-체커 적용
     */
    @PostMapping("/correction-requests/{requestId}/approve")
    public CorrectionRequestProcessResponse approve(
            @CurrentUserId Long userId,
            @PathVariable Long requestId,
            @RequestBody(required = false) CorrectionRequestApproveRequest body
    ) {
        return correctionRequestService.approve(userId, requestId, body);
    }

    /**
     * 정정 요청 반려
     * - PENDING만 가능 / MANAGER(동일 site) 또는 ADMIN / 메이커-체커 적용
     */
    @PostMapping("/correction-requests/{requestId}/reject")
    public CorrectionRequestProcessResponse reject(
            @CurrentUserId Long userId,
            @PathVariable Long requestId,
            @RequestBody CorrectionRequestRejectRequest body
    ) {
        return correctionRequestService.reject(userId, requestId, body);
    }
}