package io.github.anpk.attendanceapp.site.interfaces.dto;

public record SiteResponse(
        Long siteId,
        String name,
        boolean active
) {}