package io.github.anpk.attendanceapp.attendance.interfaces;

import io.github.anpk.attendanceapp.attendance.application.service.AttendanceService;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceActionResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceListResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceReadResponse;
import io.github.anpk.attendanceapp.auth.CurrentUserId;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(
            AttendanceService attendanceService
    ) {
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

    @PostMapping("/check-out")
    public ResponseEntity<AttendanceActionResponse> checkOut(@CurrentUserId Long userId) {
        return ResponseEntity.ok(attendanceService.checkOut(userId));
    }

    /**
     * 오늘 상태 조회 (Final 합성 규칙 적용)
     * - /{attendanceId} 와 충돌 방지: attendanceId는 숫자만 매칭하도록 아래에서 제한
     */
    @GetMapping("/today")
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
     * 목록 조회: month=YYYY-MM 만 우선 지원
     * - 최소 UX: month 미입력 시 이번 달 기본값은 Service에서 처리
     */
    @GetMapping
    public AttendanceListResponse list(
            @CurrentUserId Long userId,
            @RequestParam(required = false) String month
    ) {
        // 최소: paging 미지원이면 page/size 고정
        return attendanceService.listMyAttendancesByMonth(userId, month, 1, 1000);
    }

    /**
     * Attendance 단건 조회
     * - /today 와 충돌 방지: 숫자 패턴만 매칭
     */
    @GetMapping("/{attendanceId:\\d+}")
    public AttendanceReadResponse read(
            @CurrentUserId Long userId,
            @PathVariable Long attendanceId
    ) {
        return attendanceService.getMyAttendance(userId, attendanceId);
    }
}