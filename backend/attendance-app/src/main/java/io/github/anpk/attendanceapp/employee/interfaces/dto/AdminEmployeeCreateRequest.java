package io.github.anpk.attendanceapp.employee.interfaces.dto;

public record AdminEmployeeCreateRequest(
        Long userId,
        String username,
        String password,
        Long siteId
) {}