package io.github.anpk.attendanceapp.employee.domain;

/**
 * 직원 권한 (최소)
 * - EMPLOYEE: 일반 사용자
 * - MANAGER: 동일 site의 정정 요청 승인/반려 가능
 * - ADMIN: 전체 site 백스톱
 */
public enum EmployeeRole {
    EMPLOYEE,
    MANAGER,
    ADMIN
}