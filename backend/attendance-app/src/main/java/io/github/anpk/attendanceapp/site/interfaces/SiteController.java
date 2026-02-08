package io.github.anpk.attendanceapp.site.interfaces;

import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.site.application.service.SiteService;
import io.github.anpk.attendanceapp.site.interfaces.dto.ManagerSiteAssignRequest;
import io.github.anpk.attendanceapp.site.interfaces.dto.SiteCreateRequest;
import io.github.anpk.attendanceapp.site.interfaces.dto.SiteResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sites")
public class SiteController {

    private final SiteService siteService;

    public SiteController(SiteService siteService) {
        this.siteService = siteService;
    }

    @GetMapping
    public List<SiteResponse> list(@CurrentUserId Long userId) {
        return siteService.listVisibleSites(userId);
    }

    @PostMapping
    public ResponseEntity<SiteResponse> create(@CurrentUserId Long userId, @RequestBody SiteCreateRequest req) {
        var created = siteService.create(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/assignments")
    public ResponseEntity<Void> assignManager(@CurrentUserId Long userId, @RequestBody ManagerSiteAssignRequest req) {
        siteService.assignManagerToSite(userId, req);
        return ResponseEntity.ok().build();
    }
}