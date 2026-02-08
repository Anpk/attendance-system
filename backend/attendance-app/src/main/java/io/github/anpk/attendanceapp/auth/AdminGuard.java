package io.github.anpk.attendanceapp.auth;

import io.github.anpk.attendanceapp.employee.domain.model.Employee;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import org.springframework.stereotype.Component;

@Component
public class AdminGuard {

    private final EmployeeRepository employeeRepository;

    public AdminGuard(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    public void requireAdmin(Long userId) {
        var me = requireActiveEmployee(userId);
        if (me.getRole() != EmployeeRole.ADMIN) throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
    }

    public EmployeeRole requireAdminOrManager(Long userId) {
        var me = requireActiveEmployee(userId);
        if (me.getRole() != EmployeeRole.ADMIN && me.getRole() != EmployeeRole.MANAGER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
        return me.getRole();
    }

    private Employee requireActiveEmployee(Long userId) {
        var me = employeeRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
        if (!me.isActive()) {
            throw new BusinessException(ErrorCode.EMPLOYEE_INACTIVE, "비활성 사용자입니다.");
        }
        return me;
    }
}