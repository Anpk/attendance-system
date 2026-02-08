package io.github.anpk.attendanceapp.site.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@NoArgsConstructor
@Entity
@Table(
        name = "manager_site_assignments",
        uniqueConstraints = @UniqueConstraint(name = "uk_manager_site", columnNames = {"manager_user_id", "site_id"})
)
public class ManagerSiteAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "manager_user_id", nullable = false)
    private Long managerUserId;

    @Column(name = "site_id", nullable = false)
    private Long siteId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public ManagerSiteAssignment(Long managerUserId, Long siteId, OffsetDateTime createdAt) {
        this.managerUserId = managerUserId;
        this.siteId = siteId;
        this.createdAt = createdAt;
    }
}