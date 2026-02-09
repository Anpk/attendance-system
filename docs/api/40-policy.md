# Policy API

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

- Site(영업 지점 / 고객사)별 **근태 정책(Policy)** 을 관리하는 API를 정의한다.
- 본 문서는 **정책 조회 및 설정 API**만 다루며, 근태 기록의 생성/정정 로직은 포함하지 않는다.
- 정책 변경은 **미래 검증 로직에만 영향**을 미친다.

---

## 🔐 Authorization & Roles

- Allowed Roles
  - `ADMIN`

> 정책은 **관리자만 변경 가능**하다.

---

## 🧱 Design Constraints (Fixed)

- 정책은 **Site 단위로 관리**된다.
- 정책 변경은 **과거 근태 데이터에 영향을 주지 않는다**.
- 근태 검증은 항상 **정책 + 실제 기록 시간**을 기준으로 수행된다.
- 시간 기준은 **Asia/Seoul** 이다.

---

## 📎 Related Contract Sections

- Contract §6 — Attendance Validation
- Contract §7 — Admin Operations
- Contract §10 — Policy Management

---

## 1. Policy Model

### Fields

| Field         | Type    | Description                   |
|---------------|---------|-------------------------------|
| workStartTime | string  | 근무 시작 시간 (HH:mm)        |
| workEndTime   | string  | 근무 종료 시간 (HH:mm)        |
| graceMinutes  | number  | 허용 지각/조기 퇴근 분        |
| active        | boolean | 정책 활성 여부                |

---

## 2. Get Policy (조회)

### Endpoint

**GET** `/api/admin/sites/{siteId}/policy`

---

### Description

- 특정 Site에 적용 중인 근태 정책을 조회한다.
- 정책이 없는 경우 **기본 정책(Default Policy)** 이 적용된다.

---

### Response

```json
{
  "siteId": 10,
  "workStartTime": "09:00",
  "workEndTime": "18:00",
  "graceMinutes": 10,
  "active": true
}
```

---

## 3. Create Policy (생성)

### Endpoint

**POST** `/api/admin/sites/{siteId}/policy`

---

### Description

- Site에 새로운 근태 정책을 생성한다.
- 이미 정책이 존재하는 경우 **생성은 거부**된다.

---

### Request Body

```json
{
  "workStartTime": "09:00",
  "workEndTime": "18:00",
  "graceMinutes": 10,
  "active": true
}
```

---

### Server-side Rules

- `workStartTime < workEndTime`
- `graceMinutes >= 0`
- 동일 Site에 정책은 1개만 존재 가능

---

### Success Response

**201 Created**

```json
{
  "siteId": 10,
  "policyId": 3
}
```

---

## 4. Update Policy (수정)

### Endpoint

**PATCH** `/api/admin/sites/{siteId}/policy`

---

### Description

- 기존 Site 근태 정책을 수정한다.
- 수정 즉시 **이후 검증 로직부터 적용**된다.

---

### Request Body

```json
{
  "workStartTime": "10:00",
  "workEndTime": "19:00",
  "graceMinutes": 5,
  "active": true
}
```

---

### Server-side Rules

- 시간 순서 검증 필수
- 과거 근태 데이터에는 영향 없음

---

### Success Response

**200 OK**

```json
{
  "siteId": 10,
  "policyId": 3,
  "updatedAt": "2026-01-18T20:00:00+09:00"
}
```

---

## 📌 Important Notes

- 정책은 **근태 유효성 검증 기준**으로만 사용된다.
- 정책 비활성화 시, 시스템 기본 정책이 적용된다.
- 정책 변경은 **리포트/집계 결과를 소급 수정하지 않는다**.

---

> **Policy behavior must always comply with the Contract.**
