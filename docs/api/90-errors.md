# Error Handling API

> ⚠️ **Reference Document (Non-authoritative)**
>
> This document is an **implementation reference** for the Attendance System.  
> The **authoritative contract** is:
>
> 👉 `/docs/ATTENDANCE_SYSTEM_SPEC.md`
>
> In case of any conflict, ambiguity, or mismatch,  
> **the contract document always prevails.**

---

## 📌 Scope & Purpose

- 근태관리 시스템 전반에서 사용하는 **공통 에러 응답 규격과 에러 코드 체계**를 정의한다.
- 본 문서는 **HTTP Status 사용 원칙, 에러 응답 포맷, 도메인별 에러 코드 분류**만을 다룬다.
- 개별 비즈니스 규칙의 판단 기준은 **Contract를 따른다**.

---

## 🧱 Design Principles (Fixed)

- 모든 API 에러는 **단일 표준 포맷**으로 응답한다.
- HTTP Status는 **의미에 맞게 사용**한다.
- 클라이언트는 `error.code`를 기준으로 분기 처리한다.
- 에러 메시지는 **사용자 노출용이 아닌 로그/디버깅 목적**이다.

---

## 📎 Related Contract Sections

- Contract §9 — Error Handling
- Contract §3 — Attendance
- Contract §4 — Correction Request

---

## 1. Standard Error Response Format

### Response Body

```json
{
  "timestamp": "2026-01-18T20:30:45+09:00",
  "status": 409,
  "error": "CONFLICT",
  "code": "ALREADY_CHECKED_IN",
  "message": "Attendance already checked in",
  "path": "/api/attendance/check-in"
}
```

### Fields

| Field     | Type   | Description |
|-----------|--------|-------------|
| timestamp | string | 에러 발생 시각 (ISO-8601, Asia/Seoul) |
| status    | number | HTTP Status Code |
| error     | string | HTTP Status Name |
| code      | string | 시스템 내부 에러 코드 |
| message   | string | 에러 설명 (로그/디버깅용) |
| path      | string | 요청 URI |

---

## 2. HTTP Status Usage Rules

| Status | Usage |
|-------:|------|
| 400 | 잘못된 요청 형식, 파라미터 누락 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 상태 충돌 |
| 422 | 유효성 검증 실패 |
| 500 | 서버 내부 오류 |

---

## 3. Error Code Naming Convention

- UPPER_SNAKE_CASE
- 도메인 의미가 드러나도록 명명
- 클라이언트 분기 기준으로 변경 금지

---

## 4. Common Error Codes

### Request Binding / Validation

| Code | HTTP | Description |
|------|------|-------------|
| MISSING_REQUIRED_PARAM | 400 | 필수 쿼리/폼 파라미터 누락 (예: userId 누락)|
| INVALID_REQUEST_PARAM | 400 | 파라미터 타입/포맷 오류(예: userId=abc) |
| INVALID_REQUEST_PAYLOAD | 422 | 요청 payload 검증 실패(@Valid 등) |

---

### Authorization / Authentication

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | 인증 실패 |
| FORBIDDEN | 403 | 권한 없음 |

---

### Framework / Endpoint

| Code | HTTP | Description |
|------|------|-------------|
| ENDPOINT_NOT_FOUND | 404 | 존재하지 않는 API 경로 호출 |

---

### Attendance Domain

| Code | HTTP | Description |
|------|------|-------------|
| ALREADY_CHECKED_IN | 409 | 이미 출근 |
| NOT_CHECKED_IN | 409 | 출근 기록 없음 |
| ALREADY_CHECKED_OUT | 409 | 이미 퇴근 |
| OPEN_ATTENDANCE_EXISTS | 409 | 미종료 근태 |
| EMPLOYEE_INACTIVE | 403 | 비활성 직원 |
| ATTENDANCE_NOT_FOUND | 404 | 근태 없음 |

---

### Correction Request Domain

| Code | HTTP | Description |
|------|------|-------------|
| PENDING_REQUEST_EXISTS | 409 | 처리 중 요청 |
| OUT_OF_CORRECTION_WINDOW | 422 | 정정 기간 초과 |
| INVALID_TIME_ORDER | 422 | 시간 순서 오류 |
| EXCEEDS_MAX_WORK_DURATION | 422 | 근무 시간 초과 |
| INVALID_STATUS_TRANSITION | 409 | 상태 전이 오류 |

---

### Policy / Admin Domain

| Code | HTTP | Description |
|------|------|-------------|
| POLICY_ALREADY_EXISTS | 409 | 정책 존재 |
| POLICY_NOT_FOUND | 404 | 정책 없음 |
| SITE_INACTIVE | 403 | 비활성 Site |
| EMPLOYEE_NOT_FOUND | 404 | 직원 없음 |

---

## 📌 Client Handling Guidelines

- 클라이언트는 message 문자열에 의존하지 않는다.
- UI 분기는 code 기준으로 처리한다.
- 알 수 없는 code는 공통 오류 처리한다.

---

## 📌 Important Notes

- 에러 코드 추가/변경은 Contract 변경이다.
- 에러 응답 포맷은 모든 API에서 동일해야 한다.

---

> **Error handling is part of the system contract, not an implementation detail.**
