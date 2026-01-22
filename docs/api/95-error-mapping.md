# Error Mapping (BusinessException ↔ 90-errors)

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

- 본 문서는 `BusinessException(code)` 및 Spring 예외를 **`90-errors.md`의 에러 응답 계약**에 맞게 매핑하기 위한 운영 표준이다.
- 이 문서는 **코드 값(code) → HTTP Status / error(status name)** 매핑을 고정한다.
- 클라이언트는 `code`를 기준으로 분기 처리하며, `message`에 의존하지 않는다.

---

## 🧱 Principles (Fixed)

- `BusinessException.code`는 **`90-errors.md`에 정의된 code 문자열과 100% 동일**해야 한다.
- `BusinessException`이 HTTP Status를 포함하지 않는 현재 구조에서는, **GlobalExceptionHandler가 code 기반으로 HTTP Status를 결정**한다.
- `90-errors.md` 표준 응답 필드 중 `timestamp`, `status`, `error`, `path`는 **Handler가 생성**한다.
- 계약에 없는 code가 발생하면, 서버는 **500(INTERNAL_ERROR)** 로 강제 변환한다.

---

## 📎 Related Documents

- [`90-errors.md`](./90-errors.md)
- [`10-attendance.md`](./10-attendance.md)
- [`20-correction-requests.md`](./20-correction-requests.md)
- [`30-admin-ops.md`](./30-admin-ops.md)
- [`40-policy.md`](./40-policy.md)

---

## 1. Mapping Table (BusinessException.code → HTTP)

### 1.0 Request Binding / Validation (Spring / Input)

| code | HTTP | error | Example |
|---|---:|---|---|
| MISSING_REQUIRED_PARAM | 400 | BAD_REQUEST | 필수 파라미터 누락 (예: userId 누락) |
| INVALID_REQUEST_PARAM | 400 | BAD_REQUEST | 파라미터 타입/포맷 오류 (예: userId=abc) |
| INVALID_REQUEST_PAYLOAD | 422 | UNPROCESSABLE_ENTITY | @Valid 등 payload 검증 실패 |

---

### 1.1 Authorization / Authentication

| code | HTTP | error | Notes |
|---|---:|---|---|
| UNAUTHORIZED | 401 | UNAUTHORIZED | (현재 임시 인증 컨텍스트: X-USER-ID 헤더 누락/무효 시 사용. 추후 JWT/세션으로 교체 가능) |
| FORBIDDEN | 403 | FORBIDDEN | (권한/스코프 위반 시 사용) |

---

### 1.2 Attendance Domain

| code | HTTP | error | Example |
|---|---:|---|---|
| ALREADY_CHECKED_IN | 409 | CONFLICT | 당일 출근 중복 |
| NOT_CHECKED_IN | 409 | CONFLICT | 출근 없이 퇴근 시도 |
| ALREADY_CHECKED_OUT | 409 | CONFLICT | 퇴근 중복 |
| OPEN_ATTENDANCE_EXISTS | 409 | CONFLICT | 미종료 근태 존재 |
| EMPLOYEE_INACTIVE | 403 | FORBIDDEN | 비활성 직원 |

---

### 1.3 Correction Request Domain

| code | HTTP | error | Example |
|---|---:|---|---|
| PENDING_REQUEST_EXISTS | 409 | CONFLICT | 동일 Attendance PENDING 중복 |
| OUT_OF_CORRECTION_WINDOW | 422 | UNPROCESSABLE_ENTITY | 당월 외 정정 |
| INVALID_TIME_ORDER | 422 | UNPROCESSABLE_ENTITY | 출근 ≥ 퇴근 |
| EXCEEDS_MAX_WORK_DURATION | 422 | UNPROCESSABLE_ENTITY | 근무시간 24h 초과 |
| INVALID_STATUS_TRANSITION | 409 | CONFLICT | 상태 전이 규칙 위반 |

---

### 1.4 Policy / Admin Domain

| code | HTTP | error | Example |
|---|---:|---|---|
| POLICY_ALREADY_EXISTS | 409 | CONFLICT | 정책 중복 생성 |
| POLICY_NOT_FOUND | 404 | NOT_FOUND | 정책 조회/수정 대상 없음 |
| SITE_INACTIVE | 403 | FORBIDDEN | 비활성 Site |
| EMPLOYEE_NOT_FOUND | 404 | NOT_FOUND | 직원 없음 |

---

## 2. Non-Contract Codes (Current Implementation)

현재 구현(예: `GlobalExceptionHandler`)에서 계약 밖 code가 생성될 수 있다.  
이 경우 아래 원칙을 따른다. (가능한 한 **계약 코드로 정렬**한다.)

### 2.1 Deprecated Codes (Do Not Use)

- `VALIDATION_ERROR`
  - 과거/임시 구현에서 사용될 수 있으나, **Contract 문서에 정의되지 않은 비계약 코드**이다.
  - 신규 구현/유지보수에서 **사용하지 않는다.**
  - Validation/Binding 오류는 본 문서 1.0의 계약 코드로 매핑한다:
    - `MISSING_REQUIRED_PARAM` (400)
    - `INVALID_REQUEST_PARAM` (400)
    - `INVALID_REQUEST_PAYLOAD` (422)

---

### 2.2 Internal Errors

- Current: `INTERNAL_ERROR` (500)
- Target:
  - HTTP: **500**
  - code: `INTERNAL_ERROR` (유지 가능)
  - message: “서버 내부 오류가 발생했습니다.”

> `INTERNAL_ERROR`가 Contract에 없다면 `90-errors.md`에 추가하여 계약화한다.

---

## 3. Standard Error Response (Handler Responsibility)

Handler는 모든 예외를 아래 표준 포맷으로 응답해야 한다.

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

### Field Source

| Field | Source |
|---|---|
| timestamp | Handler generates (Asia/Seoul) |
| status | code → HttpStatus mapping |
| error | HttpStatus name |
| code | BusinessException.code |
| message | Exception message (log/debug) |
| path | HttpServletRequest URI |

---

## 4. Fallback Rule (Unknown Code)

`BusinessException.code`가 매핑 테이블에 없거나 계약 문서에 존재하지 않는 경우:

- HTTP: **500**
- code: **INTERNAL_ERROR**
- message: “서버 내부 오류가 발생했습니다.”

> Unknown code는 클라이언트 분기 불가 및 계약 위반 가능성이 있으므로 서버가 강제 통제한다.

---

## 📌 Change Control

- 매핑 테이블 변경(HTTP 변경, code 추가/삭제)은 **Contract 변경**으로 취급한다.
- 배포 전 `90-errors.md` 및 본 문서(95-error-mapping.md)가 함께 갱신되어야 한다.

---

> **This mapping is part of the API contract surface area.**
