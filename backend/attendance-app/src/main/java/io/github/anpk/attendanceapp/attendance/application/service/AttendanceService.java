package io.github.anpk.attendanceapp.attendance.application.service;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceActionResponse;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AttendanceService {

    // 업로드 파일 검증 정책(서버 측) - 필요 시 운영 환경에 맞게 조정
    private static final long MAX_PHOTO_BYTES = 5L * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"
    );
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "heic", "heif"
    );

    private final AttendanceRepository attendanceRepository;

    public AttendanceService(AttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    @Transactional
    public AttendanceActionResponse checkIn(Long userId, MultipartFile photo) throws IOException {
        LocalDate today = LocalDate.now();

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
        LocalDate today = LocalDate.now();

        var attendance = attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_CHECKED_IN, "출근 기록이 없어 퇴근할 수 없습니다."));

        if (attendance.getCheckOutTime() != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT, "이미 퇴근 처리되었습니다.");
        }

        attendance.checkOut(LocalDateTime.now());

        var saved = attendanceRepository.save(attendance);
        return AttendanceActionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public AttendanceActionResponse getToday(Long userId) {
        LocalDate today = LocalDate.now();

        return attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .map(AttendanceActionResponse::from)
                .orElse(new AttendanceActionResponse(
                        null,
                        today.toString(),
                        null,
                        null,
                        false)
                );
    }

    @Transactional(readOnly = true)
    public List<Attendance> findByWorkDate(LocalDate date) {
        return attendanceRepository.findByWorkDate(date);
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
}
