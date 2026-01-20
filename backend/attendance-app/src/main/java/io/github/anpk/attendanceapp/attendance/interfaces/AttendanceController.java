package io.github.anpk.attendanceapp.attendance.interfaces;

import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceResponse;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;
import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;

    public AttendanceController(AttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    // 출근 기록 저장
    @PostMapping(value = "/check-in", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public void checkIn(
            @RequestParam Long userId,
            @RequestParam MultipartFile photo
    ) throws IOException {

        /*
        if (photo.isEmpty()) {
            // TODO(contract): validation 전용 error code 필요 (spec에 추가 후 ErrorCode로 반영)
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "출근 사진은 필수입니다.");
        }
        */


        LocalDate today = LocalDate.now();

        attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .ifPresent(a -> {
                    throw new BusinessException(
                            ErrorCode.ALREADY_CHECKED_IN,
                            "이미 출근 처리되었습니다."
                    );
                });

        // 업로드 디렉토리 생성
        String uploadDir = System.getProperty("user.dir") + "/uploads";
        Files.createDirectories(Path.of(uploadDir));

        // 파일명 충돌 방지
        String filename = UUID.randomUUID() + "_" + photo.getOriginalFilename();
        Path filePath = Path.of(uploadDir, filename);

        // 파일 저장
        photo.transferTo(filePath.toFile());

        // 엔티티 생성 (정적 팩토리)
        Attendance attendance = Attendance.checkIn(
                userId,
                today,
                LocalDateTime.now(),
                filePath.toString()
        );

        attendanceRepository.save(attendance);
    }

    // 날짜별 조회
    @GetMapping
    public List<Attendance> findByDate(@RequestParam String date) {
        return attendanceRepository.findByWorkDate(LocalDate.parse(date));
    }

    //미구현 로직
    /*
    @PostMapping("/check-out")
    public Attendance checkOut(@RequestBody AttendanceCheckoutRequest request) {

        LocalDate today = LocalDate.now();

        Attendance attendance = attendanceRepository
                .findByUserIdAndWorkDate(request.userId, today)
                .orElseThrow(() ->
                        // TODO(contract): NOT_CHECKED_IN 등 계약 code로 매핑할지 명확화 필요
                        new BusinessException("CHECK_IN_REQUIRED", "출근 기록이 없어 퇴근할 수 없습니다.")
                );

        if (attendance.getCheckOutTime() != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT,, "이미 퇴근 처리되었습니다.");
        }

        attendance.checkOut(LocalDateTime.now());
        return attendanceRepository.save(attendance);
    }
     */

    @GetMapping("/today")
    public AttendanceResponse getTodayAttendance(@RequestParam Long userId) {
        var today = LocalDate.now();
        var opt = attendanceRepository.findByUserIdAndWorkDate(userId, today);

        if (opt.isEmpty()) {
            return new AttendanceResponse(false, false, null, null);
        }

        var a = opt.get();

        return new AttendanceResponse(
                true,
                a.getCheckOutTime() != null,
                a.getCheckInTime() == null ? null : a.getCheckInTime().toString(),
                a.getCheckOutTime() == null ? null : a.getCheckOutTime().toString()
        );
    }
}