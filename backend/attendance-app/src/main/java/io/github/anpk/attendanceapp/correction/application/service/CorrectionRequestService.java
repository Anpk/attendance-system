package io.github.anpk.attendanceapp.correction.application.service;

import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequest;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;
import io.github.anpk.attendanceapp.correction.infrastructure.repository.CorrectionRequestRepository;
import io.github.anpk.attendanceapp.correction.interfaces.dto.*;
import io.github.anpk.attendanceapp.employee.domain.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.List;

@Service
public class CorrectionRequestService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Duration MAX_WORK_DURATION = Duration.ofHours(24);

    private final AttendanceRepository attendanceRepository;
    private final CorrectionRequestRepository correctionRequestRepository;
    private final EmployeeRepository employeeRepository;

    public CorrectionRequestService(
            AttendanceRepository attendanceRepository,
            CorrectionRequestRepository correctionRequestRepository,
            EmployeeRepository employeeRepository
    ) {
        this.attendanceRepository = attendanceRepository;
        this.correctionRequestRepository = correctionRequestRepository;
        this.employeeRepository = employeeRepository;
    }

    @Transactional
    public CorrectionRequestResponse create(Long userId, Long attendanceId, CorrectionRequestCreateRequest req) {
        // 1) Attendance 조회 + 본인 스코프 강제
        var attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ATTENDANCE_NOT_FOUND, "근태 정보를 찾을 수 없습니다."));

        if (!attendance.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        // 2) 당월만 허용(Attendance.workDate 기준)
        YearMonth target = YearMonth.from(attendance.getWorkDate());
        YearMonth now = YearMonth.from(LocalDate.now(KST));
        if (!target.equals(now)) {
            throw new BusinessException(ErrorCode.OUT_OF_CORRECTION_WINDOW, "당월 근태만 정정 요청이 가능합니다.");
        }

        // 3) 동일 Attendance PENDING 중복 금지
        if (correctionRequestRepository.existsByAttendance_IdAndStatus(attendanceId, CorrectionRequestStatus.PENDING)) {
            throw new BusinessException(ErrorCode.PENDING_REQUEST_EXISTS, "처리 중인 정정 요청이 이미 존재합니다.");
        }

        // 4) type 결정(미입력 시 proposed 값으로 추론)
        CorrectionRequestType type = resolveType(req);

        // 5) type-필드 강제 + reason 필수
        String reason = (req.reason() == null) ? "" : req.reason().trim();
        if (reason.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "정정 사유(reason)는 필수입니다.");
        }

        OffsetDateTime proposedIn = normalizeKst(req.proposedCheckInAt());
        OffsetDateTime proposedOut = normalizeKst(req.proposedCheckOutAt());

        enforceFieldsByType(type, proposedIn, proposedOut);

        // 6) Final 기준 시간 검증(원본 + proposed 합성)
        OffsetDateTime existingIn = toKst(attendance.getCheckInTime());
        OffsetDateTime existingOut = toKst(attendance.getCheckOutTime());

        OffsetDateTime finalIn = (type == CorrectionRequestType.CHECK_IN || type == CorrectionRequestType.BOTH) ? proposedIn : existingIn;
        OffsetDateTime finalOut = (type == CorrectionRequestType.CHECK_OUT || type == CorrectionRequestType.BOTH) ? proposedOut : existingOut;

        if (finalIn == null || finalOut == null) {
            // 최소 규칙: 최종 검증을 위해 출/퇴근이 모두 존재해야 함
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "출근/퇴근 시간이 모두 필요합니다.");
        }

        if (!finalIn.isBefore(finalOut)) {
            throw new BusinessException(ErrorCode.INVALID_TIME_ORDER, "출근 시간이 퇴근 시간보다 빨라야 합니다.");
        }

        Duration duration = Duration.between(finalIn.toInstant(), finalOut.toInstant());
        if (duration.compareTo(MAX_WORK_DURATION) > 0) {
            throw new BusinessException(ErrorCode.EXCEEDS_MAX_WORK_DURATION, "근무 시간은 24시간을 초과할 수 없습니다.");
        }

        // 7) 저장
        OffsetDateTime requestedAt = OffsetDateTime.now(KST);
        var saved = correctionRequestRepository.save(
                CorrectionRequest.pending(attendance, userId, requestedAt, type, proposedIn, proposedOut, reason)
        );

        return new CorrectionRequestResponse(
                saved.getId(),
                attendance.getId(),
                saved.getStatus(),
                saved.getType(),
                saved.getRequestedBy(),
                saved.getRequestedAt()
        );
    }

    @Transactional(readOnly = true)
    public CorrectionRequestListResponse list(Long userId, String scope, String status, Integer page, Integer size) {

        int p = (page == null || page < 1) ? 1 : page;
        int s = (size == null || size < 1) ? 20 : size;

        var pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "requestedAt"));

        // scope 분기
        if ("requested_by_me".equals(scope)) {
            var result = (status == null || status.isBlank())
                    ? correctionRequestRepository.findByRequestedBy(userId, pageable)
                    : correctionRequestRepository.findByRequestedByAndStatus(userId, parseStatus(status), pageable);

            List<CorrectionRequestResponse> items = result.getContent().stream()
                    .map(r -> new CorrectionRequestResponse(
                            r.getId(),
                            r.getAttendance().getId(),
                            r.getStatus(),
                            r.getType(),
                            r.getRequestedBy(),
                            r.getRequestedAt()
                    ))
                    .toList();

            return new CorrectionRequestListResponse(items, p, s, result.getTotalElements());
        }

        if ("approvable".equals(scope)) {
            // 승인 대기함은 권한자만 접근 가능 (MANAGER/ADMIN)
            var approver = employeeRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
            if (!approver.isActive()) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            if (approver.getRole() != EmployeeRole.MANAGER && approver.getRole() != EmployeeRole.ADMIN) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }

            CorrectionRequestStatus st = (status == null || status.isBlank())
                    ? CorrectionRequestStatus.PENDING
                    : parseStatus(status);

            var result = (approver.getRole() == EmployeeRole.ADMIN)
                    ? correctionRequestRepository.findByStatus(st, pageable)
                    : listApprovableForManager(approver.getSiteId(), userId, st, pageable);

            List<CorrectionRequestResponse> items = result.getContent().stream()
                    .map(r -> new CorrectionRequestResponse(
                            r.getId(),
                            r.getAttendance().getId(),
                            r.getStatus(),
                            r.getType(),
                            r.getRequestedBy(),
                            r.getRequestedAt()
                    ))
                    .toList();

            return new CorrectionRequestListResponse(items, p, s, result.getTotalElements());
        }

        throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "지원하지 않는 scope 입니다.");
    }


    @Transactional
    public CorrectionRequestCancelResponse cancel(Long userId, Long requestId) {
        // 1) 요청 조회
        var req = correctionRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.CORRECTION_REQUEST_NOT_FOUND,
                        "정정 요청을 찾을 수 없습니다."
                ));

        // 2) 요청자 본인만 취소 가능 (ADMIN 예외는 권한체계 도입 시 반영)
        if (!req.getRequestedBy().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        // 3) 상태는 반드시 PENDING
        if (req.getStatus() != CorrectionRequestStatus.PENDING) {
            throw new BusinessException(
                    ErrorCode.INVALID_STATUS_TRANSITION,
                    "PENDING 상태의 요청만 취소할 수 있습니다."
            );
        }

        // 4) 취소 처리
        var canceledAt = OffsetDateTime.now(KST);
        req.cancel(canceledAt);

        return new CorrectionRequestCancelResponse(
                req.getId(),
                req.getStatus(),
                req.getCanceledAt()
        );
    }

    @Transactional
    public CorrectionRequestProcessResponse approve(Long userId, Long requestId, CorrectionRequestApproveRequest body) {
        var req = correctionRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CORRECTION_REQUEST_NOT_FOUND, "정정 요청을 찾을 수 없습니다."));

        authorizeApprover(userId, req);

        if (req.getStatus() != CorrectionRequestStatus.PENDING) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION, "PENDING 상태만 처리할 수 있습니다.");
        }

        String comment = (body == null || body.comment() == null) ? null : body.comment().trim();
        var processedAt = OffsetDateTime.now(KST);
        req.approve(userId, processedAt, (comment == null || comment.isBlank()) ? null : comment);

        return new CorrectionRequestProcessResponse(
                req.getId(),
                req.getStatus(),
                req.getProcessedAt(),
                req.getProcessedBy(),
                req.getApproveComment(),
                null
        );
    }

    @Transactional
    public CorrectionRequestProcessResponse reject(Long userId, Long requestId, CorrectionRequestRejectRequest body) {
        var req = correctionRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CORRECTION_REQUEST_NOT_FOUND, "정정 요청을 찾을 수 없습니다."));

        authorizeApprover(userId, req);

        if (req.getStatus() != CorrectionRequestStatus.PENDING) {
            throw new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION, "PENDING 상태만 처리할 수 있습니다.");
        }

        String reason = (body == null || body.reason() == null) ? "" : body.reason().trim();
        if (reason.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "반려 사유(reason)는 필수입니다.");
        }

        var processedAt = OffsetDateTime.now(KST);
        req.reject(userId, processedAt, reason);

        return new CorrectionRequestProcessResponse(
                req.getId(),
                req.getStatus(),
                req.getProcessedAt(),
                req.getProcessedBy(),
                null,
                req.getRejectReason()
        );
    }

    private org.springframework.data.domain.Page<CorrectionRequest> listApprovableForManager(
            Long siteId,
            Long approverUserId,
            CorrectionRequestStatus status,
            org.springframework.data.domain.Pageable pageable
    ) {
        // 동일 site의 활성 사용자 목록을 가져온 뒤, 해당 사용자가 만든 요청만 노출
        var userIds = employeeRepository.findActiveUserIdsBySiteId(siteId);
        // 메이커-체커: 본인 요청은 승인 대기함에 노출하지 않음
        userIds.removeIf(id -> id.equals(approverUserId));
        if (userIds.isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }
        return correctionRequestRepository.findByRequestedByInAndStatus(userIds, status, pageable);
    }

    /**
     * 승인/반려 권한 강제 (최소)
     * - ADMIN: 전체 허용
     * - MANAGER: 동일 site만 허용
     * - 메이커-체커: 작성자 본인 처리 금지
     */
    private void authorizeApprover(Long approverUserId, CorrectionRequest req) {
        // 메이커-체커(작성자=처리자 금지)
        if (req.getRequestedBy().equals(approverUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "작성자는 자신의 요청을 승인/반려할 수 없습니다.");
        }

        var approver = employeeRepository.findById(approverUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
        if (!approver.isActive()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        if (approver.getRole() == EmployeeRole.ADMIN) {
            return;
        }

        if (approver.getRole() != EmployeeRole.MANAGER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        // 요청자의 site와 승인자의 site가 동일해야 함
        var requester = employeeRepository.findById(req.getRequestedBy())
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한 판정에 필요한 직원 정보가 없습니다."));
        if (!requester.isActive()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
        if (!requester.getSiteId().equals(approver.getSiteId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
    }

    private static CorrectionRequestType resolveType(CorrectionRequestCreateRequest req) {
        if (req.type() != null) return req.type();

        boolean hasIn = req.proposedCheckInAt() != null;
        boolean hasOut = req.proposedCheckOutAt() != null;

        if (hasIn && hasOut) return CorrectionRequestType.BOTH;
        if (hasIn) return CorrectionRequestType.CHECK_IN;
        if (hasOut) return CorrectionRequestType.CHECK_OUT;

        throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "type 또는 proposedCheckInAt/proposedCheckOutAt 중 하나는 필수입니다.");
    }

    private static void enforceFieldsByType(CorrectionRequestType type, OffsetDateTime proposedIn, OffsetDateTime proposedOut) {
        // 타입-필드 강제 (Contract 고정)
        if ((type == CorrectionRequestType.CHECK_IN || type == CorrectionRequestType.BOTH) && proposedIn == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "proposedCheckInAt이 필요합니다.");
        }
        if ((type == CorrectionRequestType.CHECK_OUT || type == CorrectionRequestType.BOTH) && proposedOut == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "proposedCheckOutAt이 필요합니다.");
        }
    }

    private static CorrectionRequestStatus parseStatus(String raw) {
        try {
            return CorrectionRequestStatus.valueOf(raw.trim().toUpperCase());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "status 값이 올바르지 않습니다.");
        }
    }

    private static OffsetDateTime normalizeKst(OffsetDateTime t) {
        if (t == null) return null;
        return t.atZoneSameInstant(KST).toOffsetDateTime();
    }

    private static OffsetDateTime toKst(LocalDateTime t) {
        if (t == null) return null;
        return t.atZone(KST).toOffsetDateTime();
    }
}