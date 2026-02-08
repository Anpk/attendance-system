package io.github.anpk.attendanceapp.site.interfaces.dto;

public record AdminManagerSiteAssignRequest(
        Long managerUserId,
        Long siteId
) {}