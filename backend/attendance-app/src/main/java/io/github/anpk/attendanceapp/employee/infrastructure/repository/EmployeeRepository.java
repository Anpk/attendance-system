package io.github.anpk.attendanceapp.employee.infrastructure.repository;

import io.github.anpk.attendanceapp.employee.domain.model.Employee;
import io.github.anpk.attendanceapp.employee.domain.model.EmployeeRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    List<Employee> findAllBySiteId(Long siteId);

    Optional<Employee> findByUserIdAndSiteId(Long userId, Long siteId);

    List<Employee> findAllBySiteIdAndRole(Long siteId, EmployeeRole role);

    List<Employee> findAllBySiteIdInAndRole(List<Long> siteIds, EmployeeRole role);

    @Query("select e.userId from Employee e where e.siteId = :siteId and e.active = true")
    List<Long> findActiveUserIdsBySiteId(@Param("siteId") Long siteId);
}
