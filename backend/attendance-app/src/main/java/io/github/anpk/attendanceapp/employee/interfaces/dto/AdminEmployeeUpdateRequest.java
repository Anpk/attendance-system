package io.github.anpk.attendanceapp.employee.interfaces.dto;

import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;

public record AdminEmployeeUpdateRequest(
        Boolean active,
        EmployeeRole role,
        Long siteId
) {}