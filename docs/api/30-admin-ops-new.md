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

> 본 문서에 정의된 API는 **ADMIN 전용**이다.

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
  "name": "강남 영업지점",
  "code": "GN-001",
  "active": true
}
```

---

### Get Sites

**GET** `/api/admin/sites`

---

### Get Site Detail

**GET** `/api/admin/sites/{siteId}`

---

### Update Site

**PATCH** `/api/admin/sites/{siteId}`

```json
{
  "name": "강남 본점",
  "active": true
}
```

---

### Activate / Deactivate Site

- **POST** `/api/admin/sites/{siteId}/activate`
- **POST** `/api/admin/sites/{siteId}/deactivate`

---

## 2. Employee Management

### Create Employee

**POST** `/api/admin/employees`

```json
{
  "name": "홍길동",
  "employeeNumber": "EMP-1001",
  "siteId": 10,
  "active": true
}
```

---

### Get Employees

**GET** `/api/admin/employees`

---

### Get Employee Detail

**GET** `/api/admin/employees/{employeeId}`

---

### Update Employee

**PATCH** `/api/admin/employees/{employeeId}`

```json
{
  "name": "홍길동",
  "active": true
}
```

---

### Activate / Deactivate Employee

- **POST** `/api/admin/employees/{employeeId}/activate`
- **POST** `/api/admin/employees/{employeeId}/deactivate`

---

## 3. Manager Management

### Create Manager

**POST** `/api/admin/managers`

```json
{
  "name": "김매니저",
  "active": true
}
```

---

### Get Managers

**GET** `/api/admin/managers`

---

### Get Manager Detail

**GET** `/api/admin/managers/{managerId}`

---

### Update Manager

**PATCH** `/api/admin/managers/{managerId}`

```json
{
  "name": "김매니저",
  "active": true
}
```

---

### Activate / Deactivate Manager

- **POST** `/api/admin/managers/{managerId}/activate`
- **POST** `/api/admin/managers/{managerId}/deactivate`

---

## 4. Manager ↔ Site Mapping

### Assign Manager to Site

**POST** `/api/admin/managers/{managerId}/sites`

```json
{
  "siteId": 10
}
```

---

### Remove Manager from Site

**DELETE** `/api/admin/managers/{managerId}/sites/{siteId}`

---

### Get Manager Sites

**GET** `/api/admin/managers/{managerId}/sites`

---

## 📌 Important Notes

- Admin API는 **운영 관리 목적**으로만 사용된다.
- 운영 데이터 변경은 **즉시 반영되지만 과거 근태에는 영향 없음**
- 모든 API 호출은 **서버 단에서 권한을 검증**한다.

---

> **Admin operations must never bypass rules defined in the Contract.**
