package io.github.anpk.attendanceapp.attendance.interfaces;

import io.github.anpk.attendanceapp.attendance.application.service.AttendanceService;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceActionResponse;
import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;
import io.github.anpk.attendanceapp.error.ErrorCode;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    // 출근 기록 저장
    @PostMapping(value = "/check-in", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttendanceActionResponse> checkIn(
            @CurrentUserId Long userId,
            @RequestParam MultipartFile photo
    ) throws IOException {
        var res = attendanceService.checkIn(userId, photo);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    // 날짜별 조회
    @GetMapping
    public List<Attendance> findByDate(@RequestParam String date) {
        return attendanceService.findByWorkDate(LocalDate.parse(date));
    }

    @PostMapping("/check-out")
    public ResponseEntity<AttendanceActionResponse> checkOut(@CurrentUserId Long userId) {
        return ResponseEntity.ok(attendanceService.checkOut(userId));
    }


    @GetMapping("/today")
    public AttendanceActionResponse getTodayAttendance(@CurrentUserId Long userId) {
        return attendanceService.getToday(userId);
    }
}