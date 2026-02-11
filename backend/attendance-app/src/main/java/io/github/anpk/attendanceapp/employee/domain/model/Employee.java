package io.github.anpk.attendanceapp.employee.domain.model;

import jakarta.persistence.*;

/**
 * 권한 판정용 최소 Employee 엔티티
 * - 승인/반려 권한(site/role) 판정을 위해서만 사용
 */
@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "site_id", nullable = false)
    private Long siteId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmployeeRole role;

    @Column(nullable = false)
    private boolean active;

    // ✅ dev 단계 최소 로그인용(추후 해시/암호화로 교체 전제)
    @Column(nullable = false, length = 100)
    private String password;

    protected Employee() {}

    // ✅ Admin 최소 관리용 도메인 메서드 (setter 노출 최소화)
    public void changeActive(boolean active) {
        this.active = active;
    }

    public void changeRole(EmployeeRole role) {
        this.role = role;
    }

    public void changeSiteId(Long siteId) {
        this.siteId = siteId;
    }

    public Long getUserId() { return userId; }
    public Long getSiteId() { return siteId; }
    public EmployeeRole getRole() { return role; }
    public boolean isActive() { return active; }
    public String getPassword() { return password; }
}