package io.github.anpk.attendance.service;

import io.github.anpk.attendance.exception.BusinessException;
import io.github.anpk.attendance.model.Attendance;
import io.github.anpk.attendance.repository.AttendanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
                    throw new BusinessException("ALREADY_CHECKED_IN", "이미 출근 처리되었습니다.");
                });

        String uploadDir = "uploads";
        Files.createDirectories(Path.of(uploadDir));

        String filename = UUID.randomUUID() + "_" + photo.getOriginalFilename();
        Path filePath = Path.of(uploadDir, filename);

        photo.transferTo(filePath.toFile());

        //Attendance attendance = new Attendance(); // ✅ 서비스에서면 같은 패키지가 아니어도 접근? -> 아니요, 아래 참고
        //attendance.setUserId(userId);
        //attendance.setWorkDate(today);
        //attendance.setCheckInTime(LocalDateTime.now());
        //attendance.setPhotoPath(filePath.toString());

        //attendanceRepository.save(attendance);
    }
}
