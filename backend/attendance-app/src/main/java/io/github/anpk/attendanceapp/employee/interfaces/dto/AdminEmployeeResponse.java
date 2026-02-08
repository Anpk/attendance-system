package io.github.anpk.attendanceapp.employee.interfaces.dto;

import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;

public record AdminEmployeeResponse(
        Long userId,
        boolean active,
        EmployeeRole role,
        Long siteId
) {}