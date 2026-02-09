package io.github.anpk.attendanceapp.site.interfaces;

import io.github.anpk.attendanceapp.auth.AdminGuard;
import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.domain.model.ManagerSiteAssignment;
import io.github.anpk.attendanceapp.site.infrastructure.repository.ManagerSiteAssignmentRepository;
import io.github.anpk.attendanceapp.site.infrastructure.repository.SiteRepository;
import io.github.anpk.attendanceapp.site.interfaces.dto.AdminManagerSiteAssignRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin/manager-site-assignments")
public class AdminManagerSiteAssignmentController {

    private final ManagerSiteAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final SiteRepository siteRepository;
    private final AdminGuard adminGuard;

    public AdminManagerSiteAssignmentController(
            ManagerSiteAssignmentRepository assignmentRepository,
            EmployeeRepository employeeRepository,
            SiteRepository siteRepository,
            AdminGuard adminGuard
    ) {
        this.assignmentRepository = assignmentRepository;
        this.employeeRepository = employeeRepository;
        this.siteRepository = siteRepository;
        this.adminGuard = adminGuard;
    }

    @PostMapping
    public void assign(@CurrentUserId Long userId, @RequestBody AdminManagerSiteAssignRequest body) {
        adminGuard.requireAdmin(userId);
        if (body == null || body.managerUserId() == null || body.siteId() == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "managerUserId/siteId는 필수입니다.");
        }
        if (!siteRepository.existsById(body.siteId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "존재하지 않는 siteId 입니다.");
        }
        var manager = employeeRepository.findById(body.managerUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND, "manager를 찾을 수 없습니다."));
        if (manager.getRole() != EmployeeRole.MANAGER) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "ROLE=MANAGER만 할당할 수 있습니다.");
        }
        if (!assignmentRepository.existsByManagerUserIdAndSiteId(body.managerUserId(), body.siteId())) {
            assignmentRepository.save(new ManagerSiteAssignment(body.managerUserId(), body.siteId(), OffsetDateTime.now()));
        }
    }

    @DeleteMapping
    @Transactional
    public void unassign(@CurrentUserId Long userId, @RequestParam Long managerUserId, @RequestParam Long siteId) {
        adminGuard.requireAdmin(userId);
        assignmentRepository.deleteByManagerUserIdAndSiteId(managerUserId, siteId);
    }

    @GetMapping("/managers/{managerUserId}/sites")
    public List<Long> listAssignedSites(@CurrentUserId Long userId, @PathVariable Long managerUserId) {
        adminGuard.requireAdmin(userId);
        return assignmentRepository.findSiteIdsByManagerUserId(managerUserId);
    }
}