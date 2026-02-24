package io.github.anpk.attendanceapp.attendance.interfaces;

import io.github.anpk.attendanceapp.attendance.application.service.AttendanceService;
import io.github.anpk.attendanceapp.attendance.interfaces.dto.AdminAttendanceReportResponse;
import io.github.anpk.attendanceapp.auth.AdminGuard;
import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.infrastructure.repository.ManagerSiteAssignmentRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자/매니저(site 스코프) 근태 리포트
 * - ADMIN: 모든 site 조회 가능
 * - MANAGER: 담당(assignments) site만 조회 가능
 */
@RestController
@RequestMapping("/api/admin/attendance/report")
public class AdminAttendanceReportController {

    private final AttendanceService attendanceService;
    private final AdminGuard adminGuard;
    private final ManagerSiteAssignmentRepository managerSiteAssignmentRepository;

    public AdminAttendanceReportController(
            AttendanceService attendanceService,
            AdminGuard adminGuard,
            ManagerSiteAssignmentRepository managerSiteAssignmentRepository
    ) {
        this.attendanceService = attendanceService;
        this.adminGuard = adminGuard;
        this.managerSiteAssignmentRepository = managerSiteAssignmentRepository;
    }

    @GetMapping
    public AdminAttendanceReportResponse reportBySite(
            @CurrentUserId Long requesterUserId,
            @RequestParam Long siteId,
            @RequestParam String from,
            @RequestParam String to
    ) {
        var role = adminGuard.requireAdminOrManager(requesterUserId);
        if (role == EmployeeRole.MANAGER) {
            // MANAGER: 담당(assignments) site만
            if (!managerSiteAssignmentRepository.existsByManagerUserIdAndSiteId(requesterUserId, siteId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
        }

        return attendanceService.getAttendanceReportBySite(siteId, from, to);
    }
}