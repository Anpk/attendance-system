package io.github.anpk.attendanceapp.attendance.domain.model;

import jakarta.persistence.*;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_break")
public class AttendanceBreak {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attendance_id", nullable = false)
    private Attendance attendance;

    @Column(nullable = false)
    private LocalDateTime breakStartTime;

    @Column
    private LocalDateTime breakEndTime;

    protected AttendanceBreak() {}

    public static AttendanceBreak start(Attendance attendance, LocalDateTime breakStartTime) {
        AttendanceBreak b = new AttendanceBreak();
        b.attendance = attendance;
        b.breakStartTime = breakStartTime;
        b.breakEndTime = null;
        return b;
    }

    public void end(LocalDateTime breakEndTime) {
        this.breakEndTime = breakEndTime;
    }

    public boolean isInProgress() {
        return breakEndTime == null;
    }

    public long durationMinutesOrZero() {
        if (breakStartTime == null || breakEndTime == null) return 0L;
        long mins = Duration.between(breakStartTime, breakEndTime).toMinutes();
        return Math.max(mins, 0L);
    }

    public Long getId() {
        return id;
    }

    public Attendance getAttendance() {
        return attendance;
    }

    public LocalDateTime getBreakStartTime() {
        return breakStartTime;
    }

    public LocalDateTime getBreakEndTime() {
        return breakEndTime;
    }
}
