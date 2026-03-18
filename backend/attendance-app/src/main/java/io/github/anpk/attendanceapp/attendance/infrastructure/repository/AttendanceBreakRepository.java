package io.github.anpk.attendanceapp.attendance.infrastructure.repository;

import io.github.anpk.attendanceapp.attendance.domain.model.AttendanceBreak;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceBreakRepository extends JpaRepository<AttendanceBreak, Long> {

    List<AttendanceBreak> findAllByAttendance_IdOrderByBreakStartTimeAsc(Long attendanceId);

    Optional<AttendanceBreak> findFirstByAttendance_IdAndBreakEndTimeIsNullOrderByBreakStartTimeDesc(Long attendanceId);

    List<AttendanceBreak> findAllByAttendance_IdIn(List<Long> attendanceIds);

    void deleteByAttendance_Id(Long attendanceId);
}
