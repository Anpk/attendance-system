package io.github.anpk.attendanceapp.employee.interfaces;

import io.github.anpk.attendanceapp.auth.AdminGuard;
import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.employee.domain.model.Employee;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.employee.interfaces.dto.AdminEmployeeCreateRequest;
import io.github.anpk.attendanceapp.employee.interfaces.dto.AdminEmployeeResponse;
import io.github.anpk.attendanceapp.employee.interfaces.dto.AdminEmployeeUpdateRequest;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.infrastructure.repository.ManagerSiteAssignmentRepository;
import io.github.anpk.attendanceapp.site.infrastructure.repository.SiteRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/employees")
public class AdminEmployeeController {

    private final EmployeeRepository employeeRepository;
    private final SiteRepository siteRepository;
    private final ManagerSiteAssignmentRepository managerSiteAssignmentRepository;
    private final AdminGuard adminGuard;

    public AdminEmployeeController(EmployeeRepository employeeRepository, SiteRepository siteRepository, ManagerSiteAssignmentRepository managerSiteAssignmentRepository, AdminGuard adminGuard) {
        this.employeeRepository = employeeRepository;
        this.siteRepository = siteRepository;
        this.managerSiteAssignmentRepository = managerSiteAssignmentRepository;
        this.adminGuard = adminGuard;
    }

    @GetMapping
    public List<AdminEmployeeResponse> list(@CurrentUserId Long userId) {
        var role = adminGuard.requireAdminOrManager(userId);

        if (role == EmployeeRole.ADMIN) {
            return employeeRepository.findAll().stream()
                    .map(e -> new AdminEmployeeResponse(e.getUserId(), e.getUsername(), e.isActive(), e.getRole(), e.getSiteId()))
                    .toList();
        }

        // MANAGER: assignments 범위의 ROLE=EMPLOYEE만 노출
        var manageableSiteIds = managerSiteAssignmentRepository.findSiteIdsByManagerUserId(userId);
        if (manageableSiteIds.isEmpty()) {
            return List.of();
        }
        return employeeRepository.findAllBySiteIdInAndRole(manageableSiteIds, EmployeeRole.EMPLOYEE).stream()
                .map(e -> new AdminEmployeeResponse(e.getUserId(), e.getUsername(), e.isActive(), e.getRole(), e.getSiteId()))
                .toList();
    }

    @PostMapping
    public AdminEmployeeResponse create(@CurrentUserId Long userId, @RequestBody(required = false) AdminEmployeeCreateRequest body) {
        adminGuard.requireAdmin(userId);

        if (body == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "요청 값이 올바르지 않습니다.");
        }
        if (body.userId() == null || body.userId() <= 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "userId는 필수입니다.");
        }
        if (body.username() == null || body.username().trim().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "username은 필수입니다.");
        }
        if (body.password() == null || body.password().trim().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "password는 필수입니다.");
        }
        if (body.role() == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "role은 필수입니다.");
        }
        // 최소 안전장치: ADMIN 생성은 운영상 위험도가 커서 차단
        if (body.role() == EmployeeRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
        if (body.siteId() == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "siteId는 필수입니다.");
        }
        if (!siteRepository.existsById(body.siteId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "존재하지 않는 siteId 입니다.");
        }
        if (employeeRepository.existsById(body.userId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "이미 존재하는 userId 입니다.");
        }

        var emp = new Employee(
                body.userId(),
                body.username().trim(),
                body.siteId(),
                body.role(),
                true,
                body.password().trim()
        );

        var saved = employeeRepository.save(emp);
        return new AdminEmployeeResponse(saved.getUserId(), saved.getUsername(), saved.isActive(), saved.getRole(), saved.getSiteId());
    }


    @PatchMapping("/{targetUserId}")
    public AdminEmployeeResponse update(
            @CurrentUserId Long userId,
            @PathVariable Long targetUserId,
            @RequestBody(required = false) AdminEmployeeUpdateRequest body
    ) {
        var role = adminGuard.requireAdminOrManager(userId);
        if (body == null || (body.active() == null && body.siteId() == null && (body.username() == null || body.username().trim().isBlank()))) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "변경할 값이 없습니다.");
        }

        var emp = employeeRepository.findById(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND, "직원을 찾을 수 없습니다."));

        if (role == EmployeeRole.MANAGER) {
            // MANAGER: assignments 범위의 EMPLOYEE만 수정 가능
            if (emp.getRole() != EmployeeRole.EMPLOYEE) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            var manageableSiteIds = managerSiteAssignmentRepository.findSiteIdsByManagerUserId(userId);
            if (manageableSiteIds.isEmpty()) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            // 대상 직원의 "현재 siteId"가 관리 범위 내여야 함
            if (!manageableSiteIds.contains(emp.getSiteId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
            // 옵션 A: siteId 변경을 요청한 경우, 변경 후 siteId도 관리 범위 내여야 함
            if (body.siteId() != null && !manageableSiteIds.contains(body.siteId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
        }

        if (body.siteId() != null && !siteRepository.existsById(body.siteId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "존재하지 않는 siteId 입니다.");
        }

        if (body.active() != null) emp.changeActive(body.active());
        if (body.siteId() != null) emp.changeSiteId(body.siteId());
        if (body.username() != null && !body.username().trim().isBlank()) emp.changeUsername(body.username().trim());

        var saved = employeeRepository.save(emp);
        return new AdminEmployeeResponse(saved.getUserId(), saved.getUsername(), saved.isActive(), saved.getRole(), saved.getSiteId());
    }
}