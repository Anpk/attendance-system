package io.github.anpk.attendanceapp.site.interfaces;

import io.github.anpk.attendanceapp.auth.AdminGuard;
import io.github.anpk.attendanceapp.auth.CurrentUserId;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.domain.model.Site;
import io.github.anpk.attendanceapp.site.infrastructure.repository.ManagerSiteAssignmentRepository;
import io.github.anpk.attendanceapp.site.infrastructure.repository.SiteRepository;
import io.github.anpk.attendanceapp.site.interfaces.dto.AdminSiteCreateRequest;
import io.github.anpk.attendanceapp.site.interfaces.dto.AdminSiteResponse;
import io.github.anpk.attendanceapp.site.interfaces.dto.AdminSiteUpdateRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/sites")
public class AdminSiteController {

    private final SiteRepository siteRepository;
    private final ManagerSiteAssignmentRepository managerSiteAssignmentRepository;
    private final AdminGuard adminGuard;

    public AdminSiteController(SiteRepository siteRepository, ManagerSiteAssignmentRepository managerSiteAssignmentRepository, AdminGuard adminGuard) {
        this.siteRepository = siteRepository;
        this.managerSiteAssignmentRepository = managerSiteAssignmentRepository;
        this.adminGuard = adminGuard;
    }

    @GetMapping
    public List<AdminSiteResponse> list(@CurrentUserId Long userId) {
        var role = adminGuard.requireAdminOrManager(userId);
        if (role == EmployeeRole.ADMIN) {
            return siteRepository.findAll().stream()
                    .map(s -> new AdminSiteResponse(s.getId(), s.getName(), s.isActive()))
                    .toList();
        }

        // MANAGER: 담당 site만
        var siteIds = managerSiteAssignmentRepository.findSiteIdsByManagerUserId(userId);
        return siteRepository.findAllById(siteIds).stream()
                .map(s -> new AdminSiteResponse(s.getId(), s.getName(), s.isActive()))
                .toList();
    }

    @PostMapping
    public AdminSiteResponse create(@CurrentUserId Long userId, @RequestBody AdminSiteCreateRequest body) {
        adminGuard.requireAdmin(userId);
        if (body == null || body.name() == null || body.name().trim().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "site name은 필수입니다.");
        }
        var saved = siteRepository.save(new Site(body.name().trim(), true));
        return new AdminSiteResponse(saved.getId(), saved.getName(), saved.isActive());
    }

    @PatchMapping("/{siteId}")
    public AdminSiteResponse update(
            @CurrentUserId Long userId,
            @PathVariable Long siteId,
            @RequestBody(required = false) AdminSiteUpdateRequest body
    ) {
        var role = adminGuard.requireAdminOrManager(userId);
        if (role == EmployeeRole.MANAGER) {
            // MANAGER: 담당 범위(site) 제한
            if (!managerSiteAssignmentRepository.existsByManagerUserIdAndSiteId(userId, siteId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
            }
        }

        if (body == null || (body.name() == null && body.active() == null)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "변경할 값이 없습니다.");
        }
        var site = siteRepository.findById(siteId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST_PARAM, "존재하지 않는 siteId 입니다."));

        if (body.name() != null && !body.name().trim().isBlank()) site.rename(body.name().trim());
        if (body.active() != null) site.changeActive(body.active());
        var saved = siteRepository.save(site);
        return new AdminSiteResponse(saved.getId(), saved.getName(), saved.isActive());
    }
}