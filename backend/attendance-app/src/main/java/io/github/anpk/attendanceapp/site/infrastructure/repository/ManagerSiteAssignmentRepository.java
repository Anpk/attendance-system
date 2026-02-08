package io.github.anpk.attendanceapp.site.infrastructure.repository;

import io.github.anpk.attendanceapp.site.domain.model.ManagerSiteAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ManagerSiteAssignmentRepository extends JpaRepository<ManagerSiteAssignment, Long> {

    boolean existsByManagerUserIdAndSiteId(Long managerUserId, Long siteId);

    void deleteByManagerUserIdAndSiteId(Long managerUserId, Long siteId);

    @Query("select m.siteId from ManagerSiteAssignment m where m.managerUserId = :managerUserId")
    List<Long> findSiteIdsByManagerUserId(Long managerUserId);
}