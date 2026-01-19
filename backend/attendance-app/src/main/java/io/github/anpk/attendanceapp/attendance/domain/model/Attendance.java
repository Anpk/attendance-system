package io.github.anpk.attendanceapp.attendance.domain.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendanceapp",
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

    @Column(name = "photo_path")
    private String photoPath;



    protected Attendance() {}

    public Attendance(Long userId, LocalDate workDate, LocalDateTime checkInTime) {
        this.userId = userId;
        this.workDate = workDate;
        this.checkInTime = checkInTime;
    }

    public static Attendance checkIn(Long userId, LocalDate workDate, LocalDateTime checkInTime, String photoPath) {
        Attendance a = new Attendance();
        a.setUserId(userId);
        a.setWorkDate(workDate);
        a.setCheckInTime(checkInTime);
        a.setPhotoPath(photoPath);
        return a;
    }

    // ===== 비즈니스 메서드 =====

    public void checkOut(LocalDateTime time) {
        this.checkOutTime = time;
    }

    // ===== setter =====

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public void setWorkDate(LocalDate workDate) {
        this.workDate = workDate;
    }

    public void setCheckInTime(LocalDateTime checkInTime) {
        this.checkInTime = checkInTime;
    }

    public void setPhotoPath(String photoPath) {
        this.photoPath = photoPath;
    }

    // ===== getter =====

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getWorkDate() { return workDate; }
    public LocalDateTime getCheckInTime() { return checkInTime; }
    public LocalDateTime getCheckOutTime() { return checkOutTime; }
    public String getPhotoPath() { return photoPath; }
}