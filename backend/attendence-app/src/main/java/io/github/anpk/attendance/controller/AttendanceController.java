package io.github.anpk.attendance.controller;

import io.github.anpk.attendance.controller.dto.AttendanceCheckoutRequest;
import io.github.anpk.attendance.controller.dto.AttendanceRequest;
import io.github.anpk.attendance.model.Attendance;
import io.github.anpk.attendance.repository.AttendanceRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/attendances")
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;

    public AttendanceController(AttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    // 출근 기록 저장
    @PostMapping
    public Attendance checkIn(@RequestBody AttendanceRequest request) {

        LocalDate today = LocalDate.now();

        attendanceRepository.findByUserIdAndWorkDate(request.userId, today)
                .ifPresent(a -> {
                    throw new IllegalStateException("이미 출근 처리되었습니다.");
                });

        Attendance attendance = new Attendance(
                request.userId,
                today,
                LocalDateTime.now()
        );

        return attendanceRepository.save(attendance);
    }

    // 날짜별 조회
    @GetMapping
    public List<Attendance> findByDate(@RequestParam String date) {
        return attendanceRepository.findByWorkDate(LocalDate.parse(date));
    }

    @PostMapping("/check-out")
    public Attendance checkOut(@RequestBody AttendanceCheckoutRequest request) {

        LocalDate today = LocalDate.now();

        Attendance attendance = attendanceRepository
                .findByUserIdAndWorkDate(request.userId, today)
                .orElseThrow(() ->
                        new IllegalStateException("출근 기록이 없어 퇴근할 수 없습니다.")
                );

        if (attendance.getCheckOutTime() != null) {
            throw new IllegalStateException("이미 퇴근 처리되었습니다.");
        }

        attendance.checkOut(LocalDateTime.now());
        return attendanceRepository.save(attendance);
    }
}