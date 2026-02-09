# Admin Operations API

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

- 관리자(Admin)를 위한 **운영 관리 API**를 정의한다.
- 본 문서는 **Site / Employee / Manager / 매핑 관리**에 대한 API만 다룬다.
- 근태 데이터 생성·정정 규칙은 다루지 않는다.

---

## 🔐 Authorization & Roles

- Allowed Roles
  - `ADMIN`
  - `MANAGER` (제한적)

### 권한 규칙(구현 기준)
- **ADMIN**
  - 본 문서의 모든 API 호출 가능
- **MANAGER**
  - `GET /api/admin/sites` : 담당 site만 조회 가능
  - `PATCH /api/admin/sites/{siteId}` : 담당 site만 수정 가능
  - 그 외(Employee 관리, Assignment 관리)는 **403(FORBIDDEN)**

### 인증 컨텍스트(고정)
- 사용자 식별은 요청 파라미터/바디가 아니라 **인증 컨텍스트**에서 결정한다.
  - 현행(임시): `X-USER-ID` 헤더 + `@CurrentUserId`

---

## 🧱 Design Constraints (Fixed)

- 운영 데이터 변경은 **근태 데이터에 직접적인 영향을 주지 않는다**
- 비활성화된 리소스는 **새로운 근태 생성에 사용될 수 없다**
- 과거 근태 데이터는 **정책 변경과 무관하게 유지**된다

---

## 📎 Related Contract Sections

- Contract §7 — Admin Operations
- Contract §8 — Organization & Roles

---

## 1. Site Management

### Create Site

**POST** `/api/admin/sites`

```json
{
  "name": "강남 영업지점"
}
```

Response 200
```json
{
  "siteId": 1,
  "name": "강남 영업지점",
  "active": true
}
```

---

### Get Sites

**GET** `/api/admin/sites`

#### 응답 범위
- ADMIN: 전체 site
- MANAGER: `manager_site_assignments`에 할당된 site만

Response 200
```json
[
  { "siteId": 1, "name": "HQ", "active": true }
]
```

### Update Site

**PATCH** `/api/admin/sites/{siteId}`

```json
{
  "name": "강남 본점",
  "active": true
}
```

Response 200
```json
{
  "siteId": 1,
  "name": "강남 본점",
  "active": true
}
```

#### 검증
- body가 null이거나, `name`과 `active`가 모두 없으면 422

---

## 2. Employee Management


### Get Employees

**GET** `/api/admin/employees`

Response 200
```json
[
  { "userId": 1, "active": true, "role": "EMPLOYEE", "siteId": 1 }
]
```

---

### Update Employee

**PATCH** `/api/admin/employees/{targetUserId}`

```json
{
  "active": false,
  "role": "MANAGER",
  "siteId": 1
}
```

Response 200
```json
{
  "userId": 1,
  "active": false,
  "role": "MANAGER",
  "siteId": 1
}
```

#### 검증
- body가 null이거나, `active/role/siteId`가 모두 없으면 422
- `siteId` 변경 시 존재하지 않는 siteId이면 400
- 존재하지 않는 targetUserId이면 404

---

## 3. Manager ↔ Site Mapping

### Assign Manager to Site (ADMIN only)

**POST** `/api/admin/manager-site-assignments`

```json
{
  "managerUserId": 101,
  "siteId": 1
}
```

Response 200 (empty)

### Remove Manager from Site (ADMIN only)

**DELETE** `/api/admin/manager-site-assignments?managerUserId={managerUserId}&siteId={siteId}`

Response 200 (empty)

---

### Get Manager Sites (ADMIN only)

**GET** `/api/admin/manager-site-assignments/managers/{managerUserId}/sites`

Response 200
```json
[1]
```

---

## 📌 Important Notes

- Admin API는 **운영 관리 목적**으로만 사용된다.
- 운영 데이터 변경은 **즉시 반영되지만 과거 근태에는 영향 없음**
- 모든 API 호출은 **서버 단에서 권한을 검증**한다.

## ❗ Error Handling(요약)
- 표준 에러 응답: `timestamp, status, error, code, message, path` (6필드)
- 대표 상태코드
  - 401: UNAUTHORIZED (인증 필요)
  - 403: FORBIDDEN / EMPLOYEE_INACTIVE (권한 없음 / 비활성 사용자)
  - 400: INVALID_REQUEST_PARAM (잘못된 path/query)
  - 422: INVALID_REQUEST_PAYLOAD (요청 바디 검증 실패)
  - 404: EMPLOYEE_NOT_FOUND (직원 대상 없음)

---

> **Admin operations must never bypass rules defined in the Contract.**
