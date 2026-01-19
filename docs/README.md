# Attendance System Documentation

이 디렉토리는 **근태관리 웹앱 프로젝트의 공식 문서 저장소**입니다.  
모든 설계, API 명세, 운영 규칙은 이 디렉토리를 기준으로 관리됩니다.

---

## 🔐 Contract (Authoritative Specification)

> ⚠️ 이 문서는 프로젝트의 최상위 설계 계약(Contract)입니다.  
> 코드, API, DB 스키마는 반드시 이 문서를 준수해야 합니다.

- **ATTENDANCE_SYSTEM_SPEC.md**  
  → 세션 이월용 마스터 문서 (Frozen / MVP 기준)

---

## 📘 API Reference (Implementation Guide)

> API 상세 명세 문서입니다.  
> **계약의 기준은 항상 `ATTENDANCE_SYSTEM_SPEC.md`이며**,  
> 아래 문서들은 이를 구체화한 참조 문서(reference)입니다.

- **api/00-index.md**  
  → API 전체 목차

- **api/10-attendance.md**  
  → 출퇴근(체크인/체크아웃), 근태 조회

- **api/20-correction-requests.md**  
  → 정정 요청 생성 / 목록 / 승인 / 반려 / 취소

- **api/30-admin-ops.md**  
  → 관리자 운영 관리 (Site / Employee / Manager / Mapping)

- **api/40-policy.md**  
  → Site별 근태 정책 관리

- **api/90-errors.md**  
  → 공통 에러 포맷 및 에러 코드 표준

---

## 🔍 Audit (Spec Compliance)

> 현재 구현 코드가 Spec을 얼마나 충족하는지 기록하는 감사 문서입니다.

- **audit/SPEC_AUDIT_CHECKLIST.md**  
  → Spec 준수 여부(PASS / FAIL / TODO) 점검표

---

## 🧭 Backlog / Migration

> Spec은 맞지만, **지금 당장 적용하지 않는 변경 사항**을 기록합니다.

- **backlog/TODO_MIGRATION.md**  
  → DB 변경, 대규모 리팩토링, 구조적 이슈 정리

---

## 📌 운영 원칙 요약

- `ATTENDANCE_SYSTEM_SPEC.md` 는 **단일 진실 소스(SSOT)** 이다.
- API 문서는 Spec을 **재서술하지 않는다**.
- Audit 문서는 **현실 상태를 숨김없이 기록**한다.
- Backlog 문서는 **의도적 미적용의 증거**다.

---

> 이 문서 구조는  
> “설계 고정 → 구현 → 점검 → 확장” 흐름을 안전하게 유지하기 위한 것이다.
