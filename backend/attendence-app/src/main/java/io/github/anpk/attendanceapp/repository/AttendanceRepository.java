package io.github.anpk.attendanceapp.repository;

import io.github.anpk.attendanceapp.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    List<Attendance> findByWorkDate(LocalDate workDate);

    Optional<Attendance> findByUserIdAndWorkDate(Long userId, LocalDate workDate);
}