package io.github.anpk.attendanceapp.attendance.domain.model;

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

    // check-in photo (new)
    @Column(name = "check_in_photo_path")
    private String checkInPhotoPath;

    // check-out photo (new)
    @Column(name = "check_out_photo_path")
    private String checkOutPhotoPath;

    // legacy (backward compatibility)
    @Deprecated
    @Column(name = "photo_path")
    private String legacyPhotoPath;



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
        a.setCheckInPhotoPath(photoPath);
        // legacy도 함께 세팅
        a.setLegacyPhotoPath(photoPath);
        return a;
    }

    // ===== 비즈니스 메서드 =====

    public void checkOut(LocalDateTime time) {
        this.checkOutTime = time;
    }

    public void checkOut(LocalDateTime time, String checkOutPhotoPath) {
        this.checkOutTime = time;
        this.checkOutPhotoPath = checkOutPhotoPath;
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

    public void setCheckInPhotoPath(String checkInPhotoPath) {
        this.checkInPhotoPath = checkInPhotoPath;
    }

    public void setCheckOutPhotoPath(String checkOutPhotoPath) {
        this.checkOutPhotoPath = checkOutPhotoPath;
    }

    @Deprecated
    public void setLegacyPhotoPath(String legacyPhotoPath) {
        this.legacyPhotoPath = legacyPhotoPath;
    }

    // ===== getter =====

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getWorkDate() { return workDate; }
    public LocalDateTime getCheckInTime() { return checkInTime; }
    public LocalDateTime getCheckOutTime() { return checkOutTime; }
    public String getCheckInPhotoPath() { return (checkInPhotoPath != null) ? checkInPhotoPath : legacyPhotoPath; }
    public String getCheckOutPhotoPath() { return checkOutPhotoPath; }
    @Deprecated public String getLegacyPhotoPath() { return legacyPhotoPath; }
}
