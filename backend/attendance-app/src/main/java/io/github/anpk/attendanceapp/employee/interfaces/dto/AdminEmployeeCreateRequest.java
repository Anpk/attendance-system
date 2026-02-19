package io.github.anpk.attendanceapp.employee.interfaces.dto;

import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;

public record AdminEmployeeCreateRequest(
        Long userId,
        String username,
        String password,
        EmployeeRole role,
        Long siteId

) {}