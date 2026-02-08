package io.github.anpk.attendanceapp.site.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "sites")
public class Site {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    public Site(String name) {
        this.name = name;
        this.active = true;
    }

    public Site(String name, boolean active) {
        this.name = name;
        this.active = active;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void deactivate() {
        this.active = false;
    }

    public void changeActive(boolean active) {
        this.active = active;
    }

}