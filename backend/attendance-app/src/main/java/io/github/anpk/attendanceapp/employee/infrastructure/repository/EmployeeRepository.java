package io.github.anpk.attendanceapp.employee.infrastructure.repository;

import io.github.anpk.attendanceapp.employee.domain.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    @Query("select e.userId from Employee e where e.siteId = :siteId and e.active = true")
    List<Long> findActiveUserIdsBySiteId(@Param("siteId") Long siteId);
}