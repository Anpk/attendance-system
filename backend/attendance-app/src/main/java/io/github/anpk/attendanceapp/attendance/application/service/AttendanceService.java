package io.github.anpk.attendanceapp.attendance.application.service;

import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;

    public AttendanceService(AttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    public void checkIn(Long userId, MultipartFile photo) throws IOException {
        LocalDate today = LocalDate.now();

        attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .ifPresent(a -> {
                    throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN, "이미 출근 처리되었습니다.");
                });

        String uploadDir = "uploads";
        Files.createDirectories(Path.of(uploadDir));

        String filename = UUID.randomUUID() + "_" + photo.getOriginalFilename();
        Path filePath = Path.of(uploadDir, filename);

        photo.transferTo(filePath.toFile());

        //Attendance attendanceapp = new Attendance(); // ✅ 서비스에서면 같은 패키지가 아니어도 접근? -> 아니요, 아래 참고
        //attendanceapp.setUserId(userId);
        //attendanceapp.setWorkDate(today);
        //attendanceapp.setCheckInTime(LocalDateTime.now());
        //attendanceapp.setPhotoPath(filePath.toString());

        //attendanceRepository.save(attendanceapp);
    }
}
