# Correction Requests API

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

- 근태(Attendance)에 대한 **정정 요청(Correction Request)** 의 생성, 조회, 승인, 반려, 취소 API를 정의한다.
- 이 문서는 **엔드포인트, 요청/응답 형식, 상태 전이 규칙, 필수 검증 포인트**만을 다룬다.
- Attendance 원본 데이터는 **직접 수정되지 않는다**.

---

## 🔐 Authorization & Roles

- `EMPLOYEE`
  - 본인 근태에 대해서만 정정 요청 생성 및 조회 가능
- `MANAGER`
  - 담당 Site 범위 내 요청 승인 / 반려 가능
- `ADMIN`
  - 전체 범위 백스톱 권한 (조회, 승인, 취소)

> 모든 권한 및 스코프 검증은 **서버에서 강제**된다.

---

## 🧱 Design Constraints (Fixed)

- 정정은 **요청 기반**으로만 처리된다.
- 정정 요청은 **당월만 허용**된다.
- 상태 전이는 아래만 허용된다.
  - `PENDING → APPROVED`
  - `PENDING → REJECTED`
  - `PENDING → CANCELED`
- **APPROVED 상태의 최신 요청 1건만** Final View에 반영된다. (최신 기준: `processedAt desc`)
- 시간 기준은 **Asia/Seoul** 이다.

### Final 합성 규칙과의 관계(중요)

- 정정 요청 API는 **정정 요청의 생성/조회/처리(승인/반려/취소)**만 담당한다.
- Attendance 조회(`/api/attendance/...`)에서 노출되는 시간은 항상 **Final 값**이며,
  Final 합성 규칙은 Attendance 조회 계층에서 **단일 경로(SSOT)**로 적용되어야 한다.
- 따라서 정정 요청의 승인 결과가 Attendance 조회에 반영되는지 확인할 때는,
  **정정 API 응답이 아니라 Attendance 조회 응답(`/today`, 목록, 단건)을 기준**으로 확인한다.

#### Final 합성 적용 범위(점검용)

- [ ] `GET /api/attendance/today` 에 Final 합성이 적용되는가?
- [ ] `GET /api/attendance` (목록: `month=YYYY-MM`) 에 Final 합성이 적용되는가?
- [ ] `GET /api/attendance/{attendanceId}` (단건) 에 Final 합성이 적용되는가?

> 참고: Final 최신 기준은 `processedAt desc` 이며, **APPROVED 상태의 최신 1건만** 반영된다.

---

## 📎 Related Contract Sections

- Contract §4 — Correction Request Process
- Contract §5 — Final View Composition
- Contract §9 — Error Handling

Note: Attendance 도메인 API 경로는 Contract에 따라 단수형(`/api/attendance/...`)을 사용한다.

---

## 1. Correction Request Model

### Status

| Status    | Description                |
|-----------|----------------------------|
| PENDING   | 승인 대기                  |
| APPROVED  | 승인됨 (Final 반영 대상)   |
| REJECTED  | 반려됨                     |
| CANCELED  | 요청자에 의해 취소됨       |

---

### Type

| Type       | Description                |
|------------|----------------------------|
| CHECK_IN   | 출근 시간 정정             |
| CHECK_OUT  | 퇴근 시간 정정             |
| BOTH       | 출근 / 퇴근 동시 정정      |

---

## 2. Create Correction Request (정정 요청 생성)

### Endpoint

**POST** `/api/attendance/{attendanceId}/correction-requests`

---

### Description

- 특정 Attendance에 대해 정정 요청을 생성한다.
- 동일 Attendance에는 **PENDING 상태의 요청이 1건만** 존재할 수 있다.
- 요청 생성 시 **모든 시간 및 기간 검증**이 수행된다.

---

### Request Body

```json
{
  "type": "BOTH",
  "proposedCheckInAt": "2026-01-18T09:00:00+09:00",
  "proposedCheckOutAt": "2026-01-18T18:00:00+09:00",
  "reason": "출퇴근 시간 오기입"
}
```

| Field               | Type     | Required | Notes                          |
|---------------------|----------|----------|--------------------------------|
| type                | enum     | O        | CHECK_IN / CHECK_OUT / BOTH    |
| proposedCheckInAt   | datetime | △        | CHECK_IN, BOTH 필수            |
| proposedCheckOutAt  | datetime | △        | CHECK_OUT, BOTH 필수           |
| reason              | string   | O        | 정정 사유                      |

---

### Server-side Rules

- 정정 가능 기간: **당월만 허용**
- type 별 필드 강제
  - CHECK_IN → proposedCheckInAt 필수
  - CHECK_OUT → proposedCheckOutAt 필수
  - BOTH → 둘 다 필수
- 시간 검증
  - `proposedCheckInAt < proposedCheckOutAt` (BOTH)
  - 근무 시간은 24시간을 초과할 수 없음
- 동일 Attendance에 PENDING 요청 중복 불가

---

### Success Response

**201 Created**

```json
{
  "requestId": 55,
  "attendanceId": 101,
  "status": "PENDING",
  "type": "BOTH",
  "requestedBy": 5,
  "requestedAt": "2026-01-18T19:00:00+09:00",
  "proposedCheckInAt": "2026-01-18T09:00:00+09:00",
  "proposedCheckOutAt": "2026-01-18T18:00:00+09:00",
  "reason": "출퇴근 시간 오기입"
}
```

---

### Error Codes

| HTTP | Code                         | Description                    |
|------|------------------------------|--------------------------------|
| 409  | PENDING_REQUEST_EXISTS       | 처리 중 요청 존재              |
| 422  | OUT_OF_CORRECTION_WINDOW     | 당월 외 요청                   |
| 422  | INVALID_REQUEST_PAYLOAD      | 타입-필드 불일치               |
| 422  | INVALID_TIME_ORDER           | 출근 ≥ 퇴근                    |
| 422  | EXCEEDS_MAX_WORK_DURATION    | 근무시간 상한 초과             |

---

## 3. List / Inbox Correction Requests

### Endpoint

**GET** `/api/correction-requests`

---

### Query Parameters

| Name   | Type   | Description                               |
|--------|--------|-------------------------------------------|
| scope  | string | approvable / requested_by_me / for_me / all |
| status | string | PENDING / APPROVED / REJECTED / CANCELED  |
| page   | number | 페이지                                    |
| size   | number | 페이지 크기                               |

---

### Scope Semantics

- `approvable`
  - MANAGER Inbox (담당 Site + PENDING + 요청자 ≠ 승인자)
- `requested_by_me`
  - 내가 생성한 요청
- `for_me`
  - 내 근태에 대한 모든 요청
- `all`
  - ADMIN 전체 조회

> Inbox 필터링은 **서버에서 강제**된다.

---

### Response

```json
{
  "items": [
    {
      "requestId": 55,
      "attendanceId": 101,
      "status": "PENDING",
      "type": "BOTH",
      "requestedBy": 5,
      "requestedAt": "2026-01-18T19:00:00+09:00",
      "proposedCheckInAt": "2026-01-18T09:00:00+09:00",
      "proposedCheckOutAt": "2026-01-18T18:00:00+09:00",
      "reason": "출퇴근 시간 오기입"
    }
  ],
  "page": 1,
  "size": 20,
  "totalElements": 1
}
```

---

## 4. Read Correction Request (정정 요청 상세 조회)

### Endpoint

**GET** `/api/correction-requests/{requestId}`

---

### Query Parameters

| Name  | Type   | Required | Description |
|-------|--------|----------|-------------|
| scope | string | X        | approvable / requested_by_me / for_me / all |

---

### Rules

- `scope=approvable` 상세는 **PENDING만 허용**한다.
- `scope=approvable` 접근은 MANAGER/ADMIN 권한 범위에서만 허용된다.
- `scope=requested_by_me`는 요청자 본인만 허용된다.
- `scope`가 누락된 경우 서버는 **권한/관계 기반으로 유효한 scope로 강제/보정**할 수 있다.
  - 예: EMPLOYEE가 `scope=approvable`로 접근 시 `requested_by_me` 또는 `for_me`로 보정(또는 403) — 구현 정책에 따름
- 상세 응답은 **상세 전용 DTO**를 사용할 수 있으며, 이때 `original/current` 시간이 포함될 수 있다.

---

### Response (상세 전용)

```json
{
  "requestId": 55,
  "attendanceId": 101,
  "status": "PENDING",
  "type": "BOTH",
  "requestedBy": 5,
  "requestedAt": "2026-01-18T19:00:00+09:00",
  "proposedCheckInAt": "2026-01-18T09:00:00+09:00",
  "proposedCheckOutAt": "2026-01-18T18:00:00+09:00",
  "reason": "출퇴근 시간 오기입",
  "originalCheckInAt": "2026-01-18T09:02:11+09:00",
  "originalCheckOutAt": "2026-01-18T18:01:03+09:00",
  "currentCheckInAt": "2026-01-18T09:02:11+09:00",
  "currentCheckOutAt": "2026-01-18T18:01:03+09:00"
}
```

---

## 5. Approve Correction Request (승인)

### Endpoint

**POST** `/api/correction-requests/{requestId}/approve`

---

### Description

- PENDING 상태의 정정 요청을 승인한다.
- 승인 시 **Final 정합성 검증**이 다시 수행된다.

---

### Server-side Rules

- 상태는 반드시 PENDING
- 승인자 ≠ 요청자
- MANAGER는 담당 Site 범위 내에서만 승인 가능
- 승인 시 Final 시간 검증
  - `finalCheckInAt < finalCheckOutAt`

---

### Success Response

**200 OK**

```json
{
  "requestId": 55,
  "status": "APPROVED",
  "processedBy": 2,
  "processedAt": "2026-01-18T19:10:00+09:00",
  "approveComment": "OK",
  "rejectReason": null
}
```

---

## 6. Reject Correction Request (반려)

### Endpoint

**POST** `/api/correction-requests/{requestId}/reject`

---

### Description

- PENDING 상태의 정정 요청을 반려한다.

---

### Success Response

**200 OK**

```json
{
  "requestId": 55,
  "status": "REJECTED",
  "processedBy": 2,
  "processedAt": "2026-01-18T19:12:00+09:00",
  "approveComment": null,
  "rejectReason": "사유 미충족"
}
```

---

## 7. Cancel Correction Request (취소)

### Endpoint

**POST** `/api/correction-requests/{requestId}/cancel`

---

### Description

- 요청자가 본인의 PENDING 요청을 취소한다.
- ADMIN은 백스톱으로 취소 가능하다.

---

### Server-side Rules

- 상태는 반드시 PENDING
- 요청자 본인만 취소 가능 (ADMIN 예외)

---

### Success Response

**200 OK**

```json
{
  "requestId": 55,
  "status": "CANCELED",
  "processedAt": "2026-01-18T19:15:00+09:00",
  "processedBy": 5
}
```

---

## 📌 Important Notes

- Correction Request API는 **근태 데이터 변경의 유일한 통로**이다.
- Attendance 조회 결과는 항상 **Final View 기준**이다.
- 이 문서는 **설계 변경 제안이나 정책 변경을 포함하지 않는다.**

---

> **All correction behavior is governed by the Contract.**
