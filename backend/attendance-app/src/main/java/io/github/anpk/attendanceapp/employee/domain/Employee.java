package io.github.anpk.attendanceapp.employee.domain;

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

    protected Employee() {}

    public Long getUserId() { return userId; }
    public Long getSiteId() { return siteId; }
    public EmployeeRole getRole() { return role; }
    public boolean isActive() { return active; }
}