package io.github.anpk.attendanceapp.site.application.service;

import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import io.github.anpk.attendanceapp.employee.infrastructure.repository.EmployeeRepository;
import io.github.anpk.attendanceapp.error.BusinessException;
import io.github.anpk.attendanceapp.error.ErrorCode;
import io.github.anpk.attendanceapp.site.domain.model.ManagerSiteAssignment;
import io.github.anpk.attendanceapp.site.domain.model.Site;
import io.github.anpk.attendanceapp.site.infrastructure.repository.ManagerSiteAssignmentRepository;
import io.github.anpk.attendanceapp.site.infrastructure.repository.SiteRepository;
import io.github.anpk.attendanceapp.site.interfaces.dto.ManagerSiteAssignRequest;
import io.github.anpk.attendanceapp.site.interfaces.dto.SiteCreateRequest;
import io.github.anpk.attendanceapp.site.interfaces.dto.SiteResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.OffsetDateTime;

@Service
@Transactional
public class SiteService {

    private final SiteRepository siteRepository;
    private final ManagerSiteAssignmentRepository managerSiteAssignmentRepository;
    private final EmployeeRepository employeeRepository;

    public SiteService(
            SiteRepository siteRepository,
            ManagerSiteAssignmentRepository managerSiteAssignmentRepository,
            EmployeeRepository employeeRepository
    ) {
        this.siteRepository = siteRepository;
        this.managerSiteAssignmentRepository = managerSiteAssignmentRepository;
        this.employeeRepository = employeeRepository;
    }

    @Transactional(readOnly = true)
    public List<SiteResponse> listVisibleSites(Long userId) {
        var me = employeeRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
        if (!me.isActive()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        if (me.getRole() == EmployeeRole.ADMIN) {
            return siteRepository.findAll().stream()
                    .map(s -> new SiteResponse(s.getId(), s.getName(), s.isActive()))
                    .toList();
        }

        if (me.getRole() != EmployeeRole.MANAGER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }

        var siteIds = managerSiteAssignmentRepository.findSiteIdsByManagerUserId(userId);
        if (siteIds.isEmpty()) return List.of();

        return siteRepository.findAllById(siteIds).stream()
                .map(s -> new SiteResponse(s.getId(), s.getName(), s.isActive()))
                .toList();
    }

    public SiteResponse create(Long userId, SiteCreateRequest req) {
        requireAdmin(userId);
        if (req == null || req.name() == null || req.name().trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "name은 필수입니다.");
        }
        var s = siteRepository.save(new Site(req.name().trim()));
        return new SiteResponse(s.getId(), s.getName(), s.isActive());
    }

    public void assignManagerToSite(Long userId, ManagerSiteAssignRequest req) {
        requireAdmin(userId);
        if (req == null || req.managerUserId() == null || req.siteId() == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST_PAYLOAD, "managerUserId, siteId는 필수입니다.");
        }
        if (managerSiteAssignmentRepository.existsByManagerUserIdAndSiteId(req.managerUserId(), req.siteId())) {
            return; // idempotent
        }
        managerSiteAssignmentRepository.save(new ManagerSiteAssignment(req.managerUserId(), req.siteId(), OffsetDateTime.now()));
    }

    private void requireAdmin(Long userId) {
        var me = employeeRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다."));
        if (!me.isActive() || me.getRole() != EmployeeRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "권한이 없습니다.");
        }
    }
}