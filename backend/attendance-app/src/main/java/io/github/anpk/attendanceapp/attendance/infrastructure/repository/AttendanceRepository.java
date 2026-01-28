package io.github.anpk.attendanceapp.attendance.infrastructure.repository;

import io.github.anpk.attendanceapp.attendance.domain.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    List<Attendance> findByWorkDate(LocalDate workDate);

    Optional<Attendance> findByUserIdAndWorkDate(Long userId, LocalDate workDate);

    Page<Attendance> findByUserIdAndWorkDateBetween(Long userId, LocalDate from, LocalDate to, Pageable pageable);
}