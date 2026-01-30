package io.github.anpk.attendanceapp.attendance.interfaces;

import io.github.anpk.attendanceapp.attendance.application.service.AttendanceQueryService;
import io.github.anpk.attendanceapp.attendance.application.service.AttendanceService;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceActionResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceListResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceReadResponse;
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
    private final AttendanceQueryService attendanceQueryService;

    public AttendanceController(
            AttendanceService attendanceService,
            AttendanceQueryService attendanceQueryService
    ) {
        this.attendanceService = attendanceService;
        this.attendanceQueryService = attendanceQueryService;
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

    @PostMapping("/check-out")
    public ResponseEntity<AttendanceActionResponse> checkOut(@CurrentUserId Long userId) {
        return ResponseEntity.ok(attendanceService.checkOut(userId));
    }

    /**
     * 단건 조회 (Final 값)
     */
    @GetMapping("/{attendanceId}")
    public AttendanceReadResponse getOne(
            @CurrentUserId Long userId,
            @PathVariable Long attendanceId
    ) {
        return attendanceService.getMyAttendance(userId, attendanceId);
    }

    /**
     * 목록 조회: month=YYYY-MM 만 우선 지원
     */
    @GetMapping
    public AttendanceListResponse list(
            @CurrentUserId Long userId,
            @RequestParam(required = false) String month
    ) {
        // 최소: paging 미지원이면 page/size 고정
        return attendanceService.listMyAttendancesByMonth(userId, month, 1, 1000);
    }

    public AttendanceActionResponse today(@CurrentUserId Long userId) {
        AttendanceService.FinalSnapshot snap = attendanceService.getTodayFinalSnapshot(userId);
        return new AttendanceActionResponse(
                snap.attendanceId(),
                snap.workDate().toString(),
                snap.finalCheckInAt(),
                snap.finalCheckOutAt(),
                snap.isCorrected()
        );
    }

    /**
     * Attendance 목록 조회 (월 단위)
     * - 현재 MVP 1차: month(YYYY-MM)만 우선 지원
     */
    @GetMapping
    public AttendanceListResponse list(
            @CurrentUserId Long userId,
            @RequestParam String month,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return attendanceQueryService.listByMonth(userId, month, page, size);
    }

    /**
     * Attendance 단건 조회
     * - /today 와 충돌 방지를 위해 숫자 패턴만 매칭
     */
    @GetMapping("/{attendanceId:\\d+}")
    public AttendanceReadResponse read(
            @CurrentUserId Long userId,
            @PathVariable Long attendanceId
    ) {
        return attendanceQueryService.read(attendanceId, userId);
    }
}