package io.github.anpk.attendanceapp.attendance.application.service;

import io.github.anpk.attendanceapp.attendance.infrastructure.repository.AttendanceRepository;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceListItemResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceListResponse;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AttendanceReadResponse;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class AttendanceQueryService {

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyy-MM");

    private final AttendanceRepository attendanceRepository;

    public AttendanceQueryService(AttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    public AttendanceReadResponse read(Long attendanceId, Long userId) {
        var a = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ATTENDANCE_NOT_FOUND, "근태 정보를 찾을 수 없습니다."));

        // Contract: 권한 스코프는 서버에서 강제(현재는 EMPLOYEE 본인 스코프만 구현)
        if (!a.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        // Contract: 조회는 Final 값(현재 정정 미구현이므로 원본=Final)
        return AttendanceReadResponse.from(a, userId);
    }

    public AttendanceListResponse listByMonth(Long userId, String month, Integer page, Integer size) {
        if (month == null || month.isBlank()) {
            throw new BusinessException(ErrorCode.MISSING_REQUIRED_PARAM, "month는 필수입니다.");
        }

        final YearMonth ym;
        try {
            ym = YearMonth.parse(month, YM);
        } catch (DateTimeParseException e) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "month 형식은 YYYY-MM 이어야 합니다.");
        }

        int p = (page == null || page < 1) ? 1 : page;
        int s = (size == null || size < 1) ? 20 : size;

        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();

        var pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "workDate"));
        var result = attendanceRepository.findByUserIdAndWorkDateBetween(userId, from, to, pageable);

        List<AttendanceListItemResponse> items = result.getContent().stream()
                .map(AttendanceListItemResponse::from)
                .toList();

        return new AttendanceListResponse(items, p, s, result.getTotalElements());
    }
}
