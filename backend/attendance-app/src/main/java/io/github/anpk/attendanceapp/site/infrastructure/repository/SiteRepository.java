package io.github.anpk.attendanceapp.site.infrastructure.repository;

import io.github.anpk.attendanceapp.site.domain.model.Site;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteRepository extends JpaRepository<Site, Long> {
}