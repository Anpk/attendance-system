package io.github.anpk.attendanceapp.site.interfaces.dto;

public record AdminSiteUpdateRequest(
        String name,
        Boolean active
) {}