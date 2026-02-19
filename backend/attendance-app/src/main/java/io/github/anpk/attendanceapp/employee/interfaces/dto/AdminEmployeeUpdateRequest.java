package io.github.anpk.attendanceapp.employee.interfaces.dto;


public record AdminEmployeeUpdateRequest(
        Boolean active,
        Long siteId,
        String username
) {}