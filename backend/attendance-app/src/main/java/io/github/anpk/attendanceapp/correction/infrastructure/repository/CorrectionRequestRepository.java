package io.github.anpk.attendanceapp.correction.infrastructure.repository;

import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequest;
import io.github.anpk.attendanceapp.correction.domain.model.CorrectionRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CorrectionRequestRepository extends JpaRepository<CorrectionRequest, Long> {

    boolean existsByAttendance_IdAndStatus(Long attendanceId, CorrectionRequestStatus status);

    Page<CorrectionRequest> findByRequestedBy(Long requestedBy, Pageable pageable);

    Page<CorrectionRequest> findByRequestedByAndStatus(Long requestedBy, CorrectionRequestStatus status, Pageable pageable);

    Page<CorrectionRequest> findByStatus(CorrectionRequestStatus status, Pageable pageable);

    Page<CorrectionRequest> findByRequestedByInAndStatus(List<Long> requestedBy, CorrectionRequestStatus status, Pageable pageable);
}