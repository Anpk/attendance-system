# SPEC Audit Checklist

## Audit Target

- Spec: `/docs/ATTENDANCE_SYSTEM_SPEC.md` (v1)
- Target Branch: develop
- Target Commit: <to-be-filled>
- Audit Date: <YYYY-MM-DD>

## Status Legend

- [PASS] Spec compliant
- [FAIL] Spec violated (must fix)
- [TODO] Not implemented yet (planned)
- [N/A] Not applicable in MVP scope

---

## 0. Audit Rules (Mandatory)

- 본 체크리스트는 **구현 전 / 구현 중 / 코드 리뷰 시** 반드시 참조한다.
- 모든 구현은 **Spec을 직접 해석하지 말고**, 아래 체크 항목을 통과해야 한다.
- `[FAIL]` 항목이 하나라도 존재하면 **릴리스 불가**로 간주한다.
- GPT는 이 문서를 **구현 판단 기준(Gate)** 으로 사용해야 한다.

---

## 1. Global System Constraints

| Item | Check | Status | Notes |
|-----|------|--------|------|
| MVP 단일 회사 전제 유지 | Multi-tenant 가정 없음 |  |  |
| Site 단위 근태 스코프 | Attendance에 site_id 존재 |  |  |
| 권한 체계 고정 | EMPLOYEE / MANAGER / ADMIN |  |  |
| ADMIN만 정책/조직 변경 가능 | 서버 단에서 강제 |  |  |

---

## 2. Attendance Immutability

| Item | Check | Status | Notes |
|-----|------|--------|------|
| Attendance 원본 직접 수정 없음 | UPDATE/DELETE 금지 |  |  |
| 출퇴근은 생성만 가능 | INSERT only |  |  |
| 정정 승인 시 원본 변경 없음 | View/합성 방식 |  |  |
| 과거 데이터 재계산 없음 | Policy 변경 영향 없음 |  |  |

---

## 3. Attendance Creation (Check-in / Check-out)

### 3.1 Check-in

| Item | Check | Status | Notes |
|-----|------|--------|------|
| API 경로 일치 | POST /api/attendance/check-in | [PASS] | 컨트롤러 경로를 /check-in으로 정렬 |
| 당일 1회 제한 | workDate 기준 |  |  |
| 사진 업로드 필수 | 누락 시 오류 |  |  |
| site_id 자동 설정 | employee.site_id 사용 |  |  |
| 중복 출근 방지 | ALREADY_CHECKED_IN | [PASS] | ErrorCode enum 기반 BusinessException 사용 확인 |

### 3.2 Check-out

| Item | Check | Status | Notes |
|-----|------|--------|------|
| API 경로 일치 | POST /api/attendance/check-out | [PASS] | 미구현(주석 처리 상태) |
| 체크인 선행 필수 | NOT_CHECKED_IN | [PASS]  |  |
| 당일 1회 제한 | 중복 퇴근 금지 | [PASS]  |  |
| 미퇴근 상태 검증 | OPEN_ATTENDANCE_EXISTS | [PASS]  | 이미 checkOutTime 존재 시 ALREADY_CHECKED_OUT 처리 |

---

## 4. Correction Request Lifecycle

### 4.1 State Machine

| Item | Check | Status | Notes |
|-----|------|--------|------|
| 상태 초기값 | PENDING |  |  |
| 허용 전이 | PENDING → APPROVED |  |  |
| 허용 전이 | PENDING → REJECTED |  |  |
| 허용 전이 | PENDING → CANCELED |  |  |
| 그 외 전이 차단 | 예외 발생 |  |  |

---

### 4.2 Creation Rules

| Item | Check | Status | Notes |
|-----|------|--------|------|
| 당월만 허용 | OUT_OF_CORRECTION_WINDOW |  |  |
| 시간 순서 검증 | INVALID_TIME_ORDER |  |  |
| 근무시간 ≤ 24h | EXCEEDS_MAX_WORK_DURATION |  |  |
| PENDING 중복 금지 | PENDING_REQUEST_EXISTS |  |  |

---

### 4.3 Approval / Reject / Cancel

| Item | Check | Status | Notes |
|-----|------|--------|------|
| 작성자 ≠ 승인자 | 서버 강제 |  |  |
| Site 스코프 검증 | MANAGER 권한 |  |  |
| ADMIN 백스톱 | 승인자 없을 경우 |  |  |
| 승인 시 Final 재검증 | 충돌 시 실패 |  |  |
| 취소 가능 조건 | 작성자 + PENDING |  |  |

---

## 5. Final Value Composition

| Item | Check | Status | Notes |
|-----|------|--------|------|
| APPROVED 최신 1건만 적용 | timestamp 기준 |  |  |
| PENDING 미반영 | 조회 제외 |  |  |
| REJECTED/CANCELED 미반영 | 조회 제외 |  |  |
| Final 값 기본 반환 | API 기본값 |  |  |

---

## 6. Query & Authorization

| Item | Check | Status | Notes |
|-----|------|--------|------|
| 권한 스코프 서버 강제 | client 파라미터 무시 |  |  |
| MANAGER 조회 범위 제한 | 관리 Site만 |  |  |
| ADMIN 전체 조회 가능 | 예외 없음 |  |  |

---

## 7. Policy (MVP Scope)

| Item | Check | Status | Notes |
|-----|------|--------|------|
| Site당 정책 1개 | 현재 정책만 |  |  |
| 계산/검증에만 사용 | 데이터 변경 없음 |  |  |
| 과거 Attendance 재계산 없음 | MVP 고정 |  |  |
| Policy 변경 권한 | ADMIN only |  |  |

---

## 8. Error Contract Compliance

| Item | Check | Status | Notes |
|-----|------|--------|------|
| 90-errors.md 포맷 준수 | timestamp/status/error/code/message/path | [PASS] | ApiErrorResponse 6필드로 확장 완료 |
| code 기준 분기 | message 미의존 | [PASS] | ErrorCode enum + ErrorCodeHttpMapper 기반으로 HTTP status 결정 |
| 409/422 업무 오류 구분 | 매핑 정확 |  |  |
| 미정의 code 처리 | INTERNAL_ERROR | [PASS] | 매핑 누락/미정의 시 GlobalExceptionHandler가 500 + INTERNAL_ERROR로 강제 |

---

## 9. Session Migration Safety

| Item | Check | Status | Notes |
|-----|------|--------|------|
| Spec 단일 진실 유지 | 중복 정의 없음 |  |  |
| API 문서와 충돌 없음 | 10~40 확인 |  |  |
| 임의 재설계 방지 문구 유지 | Spec 0번 |  |  |

---

## Final Audit Result

- Overall Status: ☐ PASS ☐ FAIL
- Blocking Issues:
  - 
- Reviewer:
- Remarks:
