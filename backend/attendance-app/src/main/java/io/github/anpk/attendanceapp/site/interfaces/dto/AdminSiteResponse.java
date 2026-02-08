package io.github.anpk.attendanceapp.site.interfaces.dto;

public record AdminSiteResponse(
        Long siteId,
        String name,
        boolean active
) {}