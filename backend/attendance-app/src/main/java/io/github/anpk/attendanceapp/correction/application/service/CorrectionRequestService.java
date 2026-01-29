package io.github.anpk.attendanceapp.correction.application.service;

import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequest;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestType;
import io.github.anpk.attendanceapp.correction.infrastructure.repository.CorrectionRequestRepository;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestCreateRequest;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestListResponse;
import io.github.anpk.attendanceapp.correction.interfaces.dto.CorrectionRequestResponse;
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

    public CorrectionRequestService(
            AttendanceRepository attendanceRepository,
            CorrectionRequestRepository correctionRequestRepository
    ) {
        this.attendanceRepository = attendanceRepository;
        this.correctionRequestRepository = correctionRequestRepository;
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
        // MVP 1차: requested_by_me만 지원
        if (!"requested_by_me".equals(scope)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "현재는 scope=requested_by_me만 지원합니다.");
        }

        int p = (page == null || page < 1) ? 1 : page;
        int s = (size == null || size < 1) ? 20 : size;

        var pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "requestedAt"));

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