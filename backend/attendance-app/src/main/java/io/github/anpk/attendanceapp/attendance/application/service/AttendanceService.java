package io.github.anpk.attendanceapp.attendance.application.service;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceActionResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceListItemResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceListResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceReadResponse;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequest;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import io.github.anpk.attendanceapp.correction.infrastructure.repository.CorrectionRequestRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.*;
import java.util.List;
import java.util.regex.Pattern;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Pattern MONTH_PATTERN = Pattern.compile("^\\d{4}-\\d{2}$");

    // 업로드 파일 검증 정책(서버 측) - 필요 시 운영 환경에 맞게 조정
    private static final long MAX_PHOTO_BYTES = 5L * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"
    );
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "heic", "heif"
    );

    private final AttendanceRepository attendanceRepository;
    private final CorrectionRequestRepository correctionRequestRepository;

    public AttendanceService(
            AttendanceRepository attendanceRepository,
            CorrectionRequestRepository correctionRequestRepository
    ) {
        this.attendanceRepository = attendanceRepository;
        this.correctionRequestRepository = correctionRequestRepository;
    }

    @Transactional
    public AttendanceActionResponse checkIn(Long userId, MultipartFile photo) throws IOException {
        LocalDate today = LocalDate.now(KST);

        // 계약: 체크인은 사진 업로드 필수 + 이미지/크기 제한
        validateCheckInPhoto(photo);

        var existingOpt = attendanceRepository.findByUserIdAndWorkDate(userId, today);
        if (existingOpt.isPresent()) {
            var existing = existingOpt.get();
            // 당일 기록이 있는데 퇴근까지 완료된 경우: 출근 재시도 거부
            if (existing.getCheckOutTime() != null) {
                throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT, "이미 퇴근 처리되었습니다.");
            }
            // 당일 기록이 있고 퇴근 전인 경우: 중복 출근 거부
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN, "이미 출근 처리되었습니다.");
        }

        String photoPath = savePhoto(photo);

        Attendance attendance = Attendance.checkIn(
                userId,
                today,
                LocalDateTime.now(),
                photoPath
        );

        var saved = attendanceRepository.save(attendance);
        return AttendanceActionResponse.from(saved);
    }

    @Transactional
    public AttendanceActionResponse checkOut(Long userId) {
        LocalDate today = LocalDate.now(KST);

        var attendance = attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_CHECKED_IN, "출근 기록이 없어 퇴근할 수 없습니다."));

        if (attendance.getCheckOutTime() != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT, "이미 퇴근 처리되었습니다.");
        }

        attendance.checkOut(LocalDateTime.now());

        var saved = attendanceRepository.save(attendance);
        return AttendanceActionResponse.from(saved);
    }

    private static void validateCheckInPhoto(MultipartFile photo) {
        // 계약: photo는 필수 (누락/형식 오류는 INVALID_REQUEST_PAYLOAD/422로 처리)
        if (photo == null || photo.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "출근 사진은 필수입니다.");
        }

        // 파일 크기 제한
        if (photo.getSize() > MAX_PHOTO_BYTES) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "파일 크기가 너무 큽니다. (최대 5MB)");
        }

        // MIME 타입 검증(클라이언트 값이므로 완전 신뢰는 불가하지만 1차 필터로 유효)
        String contentType = photo.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            // MIME이 비정상인 경우 확장자로도 방어
            if (!hasAllowedExtension(photo.getOriginalFilename())) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "이미지 파일만 업로드할 수 있습니다.");
            }
            return;
        }

        // MIME이 허용이어도 확장자 allowlist 적용(운영 안정성)
        if (!hasAllowedExtension(photo.getOriginalFilename())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "이미지 파일 확장자가 올바르지 않습니다.");
        }
    }

    private static boolean hasAllowedExtension(String originalFilename) {
        if (originalFilename == null) return false;

        String name = Path.of(originalFilename).getFileName().toString();
        int dot = name.lastIndexOf('.');

        if (dot < 0 || dot == name.length() - 1) return false;

        String ext = name.substring(dot + 1).toLowerCase(Locale.ROOT);

        return ALLOWED_EXTENSIONS.contains(ext);
    }

    private static String savePhoto(MultipartFile photo) throws IOException {
        // 기존 컨트롤러 구현과 동일한 기준(user.dir/uploads) 유지
        String uploadDir = System.getProperty("user.dir") + "/uploads";
        Files.createDirectories(Path.of(uploadDir));

        // 파일명에 경로 구분자 등이 섞여도 안전하도록 basename만 사용
        String originalName = (photo.getOriginalFilename() == null || photo.getOriginalFilename().isBlank())
                ? "photo"
                : Path.of(photo.getOriginalFilename()).getFileName().toString();

        String filename = UUID.randomUUID() + "_" + originalName;
        Path filePath = Path.of(uploadDir, filename);
        photo.transferTo(filePath.toFile());

        return filePath.toString();
    }

    // =============================================================
    // 조회(READ) API 전용
    // - Controller에서 호출하는 조회 전용 메서드 묶음
    // - Final 합성 규칙(승인된 최신 정정 1건) 적용 결과를 반환
    // =============================================================

    /**
     * 월별 근태 목록 조회 (month=YYYY-MM 만 우선 지원)
     * - month 미입력 시: KST 기준 현재 월 기본값(최소 UX)
     * - 응답 시간값은 Final 합성 규칙(승인된 최신 정정 1건) 적용 결과
     */
    @Transactional(readOnly = true)
    public AttendanceListResponse listMyAttendancesByMonth(Long userId, String month, int page, int size) {
        YearMonth ym = parseYearMonthOrThrow(month);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();

        // ✅ 최소 구현: paging 없이 전체 조회가 이미 있다면 그걸 쓰세요.
        // 아래는 "기간 조회" 메서드가 있다고 가정합니다.
        List<Attendance> items = attendanceRepository.findAllByUserIdAndWorkDateBetweenOrderByWorkDateAsc(userId, from, to);

        // 월별 목록 표시/중복 요청 방지를 위해 "내 PENDING 정정 요청 존재"를 attendanceId 단위로 합성
        // 람다에서 참조하므로 재할당 없이 "한 번만" 초기화(= effectively final) 한다.
        Set<Long> pendingAttendanceIds = items.isEmpty()
                ? Set.of()
                : correctionRequestRepository
                .findByRequestedByAndStatusAndAttendance_IdIn(
                        userId,
                        CorrectionRequestStatus.PENDING,
                        items.stream().map(Attendance::getId).toList()
                )
                .stream()
                .map(cr -> cr.getAttendance().getId())
                .collect(Collectors.toSet());

        List<AttendanceListItemResponse> mapped = items.stream()
                .map(a -> {
                    FinalSnapshot snap = toFinalSnapshot(a);
                    return new AttendanceListItemResponse(
                            a.getId(),
                            a.getWorkDate().toString(),
                            snap.finalCheckInAt(),
                            snap.finalCheckOutAt(),
                            snap.isCorrected(),
                            pendingAttendanceIds.contains(a.getId())
                    );
                })
                .toList();

        // page/size/totalElements는 "최소"로 고정값 처리 (프론트에서 필요 시 paging 확장)
        return new AttendanceListResponse(mapped, page, size, mapped.size());
    }

    @Transactional(readOnly = true)
    public AttendanceReadResponse getMyAttendance(Long userId, Long attendanceId) {
        Attendance a = attendanceRepository.findByIdAndUserId(attendanceId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ATTENDANCE_NOT_FOUND, "근태 기록을 찾을 수 없습니다."));

        FinalSnapshot snap = toFinalSnapshot(a);

        // employeeId/siteId가 아직 없다면 null 처리
        return new AttendanceReadResponse(
                a.getId(),
                null,
                null,
                a.getWorkDate().toString(),
                snap.finalCheckInAt(),
                snap.finalCheckOutAt(),
                snap.isCorrected(),
                snap.appliedCorrectionRequestId()
        );
    }

    /**
     * today 응답도 Final 합성 규칙 적용 (승인된 최신 정정 1건)
     */
    @Transactional(readOnly = true)
    public FinalSnapshot getTodayFinalSnapshot(Long userId) {
        LocalDate today = LocalDate.now(KST);
        Attendance a = attendanceRepository.findByUserIdAndWorkDate(userId, today).orElse(null);
        if (a == null) {
            return FinalSnapshot.empty(today);
        }
        return toFinalSnapshot(a);
    }

    private YearMonth parseYearMonthOrThrow(String month) {
        if (month == null || month.isBlank()) {
            // 미입력 시 현재 월 기본값(최소 UX)
            return YearMonth.now(KST);
        }
        if (!MONTH_PATTERN.matcher(month).matches()) {
            throw new BusinessException(
                    ErrorCode.INVALID_MONTH_FORMAT,
                    "month 형식이 올바르지 않습니다. 예: 2026-01"
            );
        }
        int m = Integer.parseInt(month.substring(5, 7));
        if (m < 1 || m > 12) {
            throw new BusinessException(
                    ErrorCode.INVALID_MONTH_FORMAT,
                    "month 값이 올바르지 않습니다. 01~12 범위여야 합니다."
            );
        }
        return YearMonth.parse(month);
    }

    /**
     * Final 합성 규칙:
     * - APPROVED 중 최신 1건만 반영
     * - PENDING/REJECTED/CANCELED 는 반영 금지
     */
    private FinalSnapshot toFinalSnapshot(Attendance a) {
        // ✅ 승인된 정정 중 최신 1건만 반영
        // - Repository 계약: processedAt desc (현재 엔티티 필드와 정합)
        CorrectionRequest approved = correctionRequestRepository
                .findFirstByAttendance_IdAndStatusOrderByProcessedAtDesc(a.getId(), CorrectionRequestStatus.APPROVED)
                .orElse(null);

        // Attendance 원본 시간(null 가능) → KST OffsetDateTime으로 변환
        OffsetDateTime baseIn = (a.getCheckInTime() == null)
                ? null
                : a.getCheckInTime().atZone(KST).toOffsetDateTime();

        OffsetDateTime baseOut = (a.getCheckOutTime() == null)
                ? null
                : a.getCheckOutTime().atZone(KST).toOffsetDateTime();

        if (approved == null) {
            return new FinalSnapshot(
                    a.getId(),
                    a.getWorkDate(),
                    baseIn,
                    baseOut,
                    false,
                    null
            );
        }

        OffsetDateTime finalCheckIn = (approved.getProposedCheckInAt() != null)
                ? approved.getProposedCheckInAt()
                : baseIn;

        OffsetDateTime finalCheckOut = (approved.getProposedCheckOutAt() != null)
                ? approved.getProposedCheckOutAt()
                : baseOut;

        return new FinalSnapshot(
                a.getId(),
                a.getWorkDate(),
                finalCheckIn,
                finalCheckOut,
                true,
                approved.getId()
        );
    }

    /**
     * 조회 응답 조립에 사용하는 내부 스냅샷
     * - Attendance 원본 + 승인된 최신 정정 1건을 합성한 최종(Final) 값
     */

    public record FinalSnapshot(
            Long attendanceId,
            LocalDate workDate,
            OffsetDateTime finalCheckInAt,
            OffsetDateTime finalCheckOutAt,
            boolean isCorrected,
            Long appliedCorrectionRequestId
    ) {
        public static FinalSnapshot empty(LocalDate workDate) {
            return new FinalSnapshot(null, workDate, null, null, false, null);
        }
    }
}
