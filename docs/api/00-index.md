# Attendance System API Index

> ⚠️ **Reference Documentation**
>
> This directory contains **implementation-level API references** for the Attendance System.  
> The **authoritative specification** is:
>
> 👉 `/docs/ATTENDANCE_SYSTEM_SPEC.md`
>
> In case of any conflict, ambiguity, or mismatch,  
> **the contract document always prevails.**

---

## 📌 문서 목적

이 디렉토리는 **근태관리 웹앱 MVP(단일 회사 기준)** 의 API 명세를  
기능 단위로 분리하여 정리한 **참조 문서 집합**이다.

- 구현 시 API 형태를 빠르게 확인하기 위함
- 프론트엔드 / 백엔드 간 계약 보조 자료
- Contract 문서를 **대체하지 않음**

### API Path Naming Rule (Contract)
- Attendance 도메인 API 경로는 단수형을 사용한다.
  - `/api/attendance/...`

### Authentication Context (Implementation Note)
- (권장) `Authorization: Bearer <JWT>`
- (개발/호환) JWT가 없는 환경에서는 (임시) `X-USER-ID` 헤더

---

## 📂 API 문서 목록

### 1. 근태 기록 (출근 / 퇴근)

- **[`10-attendance.md`](./10-attendance.md)**
  - 출근(Check-in) / 퇴근(Check-out) API
  - 근태 단건 / 목록 조회
  - Final View 기준 응답

---

### 2. 근태 정정 요청

- **[`20-correction-requests.md`](./20-correction-requests.md)**
  - 정정 요청 생성 / 조회
  - 승인 / 반려 / 취소
  - 상태 전이 규칙 및 검증 조건

---

### 3. 관리자 운영 관리

- **[`30-admin-ops.md`](./30-admin-ops.md)**
  - Site / Employee / Manager 관리
  - Manager ↔ Site 매핑
  - 운영 데이터 관리 전용 API

---

### 4. 근태 정책 관리

- **[`40-policy.md`](./40-policy.md)**
  - Site 단위 근태 정책 조회 / 생성 / 수정
  - 근무 시간, 허용 오차 관리
  - 정책 변경의 영향 범위 명시

---

### 5. 공통 에러 규격

- **[`90-errors.md`](./90-errors.md)**
  - 표준 에러 응답 포맷
  - HTTP Status 사용 원칙
  - 도메인별 에러 코드 정의

---

## 📎 참고 사항

- 모든 API는 **Asia/Seoul 타임존 기준**으로 동작한다.
- Attendance 원본 데이터는 **직접 수정되지 않는다**.
- 정정, 정책, 검증 로직은 **Contract 기준으로만 변경 가능**하다.

---

> **This index is a navigation aid, not a source of truth.**
