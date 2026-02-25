package io.github.anpk.attendanceapp.correction.application.service;

import io.github.anpk.attendanceapp.attendance.application.service.AttendanceService;
import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequest;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;
import io.github.anpk.attendanceapp.correction.infrastructure.repository.CorrectionRequestRepository;
import io.github.anpk.attendanceapp.correction.interfaces.dto.*;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.infrastructure.repository.ManagerSiteAssignmentRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.List;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class CorrectionRequestService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Duration MAX_WORK_DURATION = Duration.ofHours(24);

    private final AttendanceRepository attendanceRepository;
    private final CorrectionRequestRepository correctionRequestRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceService attendanceService;
    private final ManagerSiteAssignmentRepository managerSiteAssignmentRepository;

    public CorrectionRequestService(
            AttendanceRepository attendanceRepository,
            CorrectionRequestRepository correctionRequestRepository,
            EmployeeRepository employeeRepository,
            AttendanceService attendanceService,
            ManagerSiteAssignmentRepository managerSiteAssignmentRepository
    ) {
        this.attendanceRepository = attendanceRepository;
        this.correctionRequestRepository = correctionRequestRepository;
        this.employeeRepository = employeeRepository;
        this.attendanceService = attendanceService;
        this.managerSiteAssignmentRepository = managerSiteAssignmentRepository;
    }

    @Transactional
    public CorrectionRequestResponse create(Long userId, Long attendanceId, CorrectionRequestCreateRequest req) {
        // 1) Attendance 조회 + 권한(본인 또는 ADMIN/MANAGER 대리 신청) 검사
        var attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ATTENDANCE_NOT_FOUND, "근태 정보를 찾을 수 없습니다."));

        ensureCanCreateForAttendance(userId, attendance.getUserId());

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
                saved.getRequestedAt(),
                saved.getProposedCheckInAt(),
                saved.getProposedCheckOutAt(),
                saved.getReason()
        );
    }

    /**
     * 정정 신청 생성 권한:
     * - 본인(attendance.userId == actor) 허용
     * - ADMIN: 전체 허용
     * - MANAGER: manager_site_assignments 범위(site) 내 직원의 attendance에 한해 허용
     */
    private void ensureCanCreateForAttendance(Long actorUserId, Long attendanceUserId) {
        if (attendanceUserId != null && attendanceUserId.equals(actorUserId)) return;

        var me = employeeRepository.findById(actorUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
        if (!me.isActive()) {
            throw new BusinessException(ErrorCode.EMPLOYEE_INACTIVE, "비활성 사용자입니다.");
        }

        if (me.getRole() == EmployeeRole.ADMIN) return;

        if (me.getRole() == EmployeeRole.MANAGER) {
            var target = employeeRepository.findById(attendanceUserId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND, "직원을 찾을 수 없습니다."));
            if (!managerSiteAssignmentRepository.existsByManagerUserIdAndSiteId(actorUserId, target.getSiteId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            return;
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
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
                            r.getRequestedAt(),
                            r.getProposedCheckInAt(),
                            r.getProposedCheckOutAt(),
                            r.getReason()
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

            // 승인 대기함(scope=approvable)은 의미상 PENDING만 노출(클라이언트 status 파라미터는 무시)
            CorrectionRequestStatus st = CorrectionRequestStatus.PENDING;

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
                            r.getRequestedAt(),
                            r.getProposedCheckInAt(),
                            r.getProposedCheckOutAt(),
                            r.getReason()
                    ))
                    .toList();

            return new CorrectionRequestListResponse(items, p, s, result.getTotalElements());
        }

        throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "지원하지 않는 scope 입니다.");
    }

    /**
     * 정정 요청 상세 조회
     * - scope 기반 접근제어를 목록/상세에서 일관되게 유지
     */
    @Transactional(readOnly = true)
    public CorrectionRequestDetailResponse read(Long userId, Long requestId, String scope) {
        var req = correctionRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.CORRECTION_REQUEST_NOT_FOUND,
                        "정정 요청을 찾을 수 없습니다."
                ));

        String sc = (scope == null) ? "" : scope.trim();

        // 1) scope=requested_by_me: 요청자 본인만
        if ("requested_by_me".equals(sc)) {
            if (!req.getRequestedBy().equals(userId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            return toDetailResponse(req);
        }

        // 2) scope=approvable: 승인 권한자만(+ 메이커-체커 동일 정책)
        if ("approvable".equals(sc)) {
            authorizeApprovableViewer(userId, req);
            // approvable의 의미는 “승인 대기함”이므로, 상세도 최소로 PENDING만 허용(원하면 완화 가능)
            if (req.getStatus() != CorrectionRequestStatus.PENDING) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            return toDetailResponse(req);
        }

        // 3) scope 미지정: (요청자 본인) OR (승인 권한자) 허용
        if (sc.isEmpty()) {
            if (req.getRequestedBy().equals(userId)) {
                return toDetailResponse(req);
            }
            // 승인 권한자로서 열람 시도
            authorizeApprovableViewer(userId, req);
            return toDetailResponse(req);
        }

        throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "지원하지 않는 scope 입니다.");
    }

    /**
     * 상세 응답 전용 매핑
     * - 목록 DTO(CorrectionRequestResponse)는 변경하지 않고, 상세에서만 원본/현재 시간을 보강합니다.
     * - Attendance는 LocalDateTime을 사용하므로 KST 기준 OffsetDateTime으로 변환해 내려줍니다.
     * - current(현재/Final)은 "승인된 최신 1건"(APPROVED, processedAt desc)을 적용한 결과로 계산합니다.
     */
    private CorrectionRequestDetailResponse toDetailResponse(CorrectionRequest r) {
        var a = r.getAttendance();

        // ✅ 제안 전(원본) 시간
        OffsetDateTime originalIn = toKst(a.getCheckInTime());
        OffsetDateTime originalOut = toKst(a.getCheckOutTime());

        // ✅ 현재(Final) 시간: AttendanceService(SSOT)의 Final 합성 규칙을 그대로 사용
        AttendanceService.FinalSnapshot snap = attendanceService.computeFinalSnapshot(a);
        OffsetDateTime currentIn = snap.finalCheckInAt();
        OffsetDateTime currentOut = snap.finalCheckOutAt();

        return new CorrectionRequestDetailResponse(
                r.getId(),
                a.getId(),
                r.getStatus(),
                r.getType(),
                r.getRequestedBy(),
                r.getRequestedAt(),
                r.getProposedCheckInAt(),
                r.getProposedCheckOutAt(),
                r.getReason(),
                originalIn,
                originalOut,
                currentIn,
                currentOut
        );
    }

    /**
     * approvable scope에서 “열람” 권한 강제 (최소)
     * - ADMIN: 전체 허용
     * - MANAGER: 동일 site만 허용
     * - 메이커-체커: 본인 요청은 approvable 스코프로 열람 불가(목록 정책과 일관)
     */
    private void authorizeApprovableViewer(Long approverUserId, CorrectionRequest req) {
        // 메이커-체커(본인 요청은 approvable 스코프에서 배제)
        if (req.getRequestedBy().equals(approverUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
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

        var requester = employeeRepository.findById(req.getRequestedBy())
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
        if (!requester.isActive()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
        if (!requester.getSiteId().equals(approver.getSiteId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
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
            Long siteId, // 기존 시그니처 유지(최소 diff) — 내부에서 담당 siteIds로 확장
            Long approverUserId,
            CorrectionRequestStatus status,
            org.springframework.data.domain.Pageable pageable
    ) {
        // ✅ 변경: manager_site_assignments의 담당 siteIds 전체를 기준으로 approvable 구성
        var siteIds = managerSiteAssignmentRepository.findSiteIdsByManagerUserId(approverUserId);
        if (siteIds == null || siteIds.isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }

        var userIds = new java.util.ArrayList<Long>();
        for (Long sid : siteIds) {
            var ids = employeeRepository.findActiveUserIdsBySiteId(sid);
            if (ids != null && !ids.isEmpty()) userIds.addAll(ids);
        }
        // 메이커-체커: 본인 요청은 승인 대기함에 노출하지 않음
        userIds.removeIf(id -> id.equals(approverUserId));

        if (userIds.isEmpty()) return org.springframework.data.domain.Page.empty(pageable);
        // 중복 제거
        var distinct = userIds.stream().distinct().toList();
        return correctionRequestRepository.findByRequestedByInAndStatus(distinct, status, pageable);
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
        // ✅ 변경: manager_site_assignments 기준
        boolean assigned = managerSiteAssignmentRepository
                .existsByManagerUserIdAndSiteId(approverUserId, requester.getSiteId());
        if (!assigned) throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
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