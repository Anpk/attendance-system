package io.github.anpk.attendanceapp.site.interfaces.dto;

public record ManagerSiteAssignRequest(
        Long managerUserId,
        Long siteId
) {}