package io.github.anpk.attendanceapp.employee.interfaces;

import io.github.anpk.attendanceapp.auth.AdminGuard;
import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.employee.interfaces.dto.AdminEmployeeResponse;
import io.github.anpk.attendanceapp.employee.interfaces.dto.AdminEmployeeUpdateRequest;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.infrastructure.repository.SiteRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/employees")
public class AdminEmployeeController {

    private final EmployeeRepository employeeRepository;
    private final SiteRepository siteRepository;
    private final AdminGuard adminGuard;

    public AdminEmployeeController(EmployeeRepository employeeRepository, SiteRepository siteRepository, AdminGuard adminGuard) {
        this.employeeRepository = employeeRepository;
        this.siteRepository = siteRepository;
        this.adminGuard = adminGuard;
    }

    @GetMapping
    public List<AdminEmployeeResponse> list(@CurrentUserId Long userId) {
        adminGuard.requireAdmin(userId);
        return employeeRepository.findAll().stream()
                .map(e -> new AdminEmployeeResponse(e.getUserId(), e.isActive(), e.getRole(), e.getSiteId()))
                .toList();
    }

    @PatchMapping("/{targetUserId}")
    public AdminEmployeeResponse update(
            @CurrentUserId Long userId,
            @PathVariable Long targetUserId,
            @RequestBody(required = false) AdminEmployeeUpdateRequest body
    ) {
        adminGuard.requireAdmin(userId);
        if (body == null || (body.active() == null && body.role() == null && body.siteId() == null)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "변경할 값이 없습니다.");
        }

        var emp = employeeRepository.findById(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND, "직원을 찾을 수 없습니다."));

        if (body.siteId() != null && !siteRepository.existsById(body.siteId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "존재하지 않는 siteId 입니다.");
        }

        if (body.active() != null) emp.changeActive(body.active());
        if (body.role() != null) emp.changeRole(body.role());
        if (body.siteId() != null) emp.changeSiteId(body.siteId());

        var saved = employeeRepository.save(emp);
        return new AdminEmployeeResponse(saved.getUserId(), saved.isActive(), saved.getRole(), saved.getSiteId());
    }
}