package io.github.anpk.attendance.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"userId", "workDate"})
        })
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private LocalDate workDate;

    private LocalDateTime checkInTime;

    private LocalDateTime checkOutTime; // ✅ 퇴근 시간

    protected Attendance() {}

    public Attendance(Long userId, LocalDate workDate, LocalDateTime checkInTime) {
        this.userId = userId;
        this.workDate = workDate;
        this.checkInTime = checkInTime;
    }

    // ===== 비즈니스 메서드 =====

    public void checkOut(LocalDateTime time) {
        this.checkOutTime = time;
    }

    // ===== getter =====

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getWorkDate() { return workDate; }
    public LocalDateTime getCheckInTime() { return checkInTime; }
    public LocalDateTime getCheckOutTime() { return checkOutTime; }
}