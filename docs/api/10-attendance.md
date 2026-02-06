#
# Attendance API

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

- 출근/퇴근(Attendance) 기록을 생성하고 조회하는 API를 정의한다.
- 이 문서는 **엔드포인트, 요청/응답 형식, 필수 검증 규칙**만 다룬다.
- 근태 데이터의 불변성, 정정 반영 규칙 등 **핵심 설계 판단은 Contract를 따른다.**

---

## 🔐 Authorization & Roles

- Allowed Roles
  - `EMPLOYEE`
  - `MANAGER`
  - `ADMIN`

- Notes
  - EMPLOYEE는 **본인 근태만** 생성/조회 가능
  - MANAGER / ADMIN은 **권한 범위 내 조회만** 가능
  - 모든 권한 검증은 **서버에서 강제**

> ✅ **User Identification (Implementation Note)**
>
> 본 문서의 생성/조회 API는 `userId`를 요청 파라미터/바디로 받지 않고,
> **인증 컨텍스트**에서 현재 사용자를 식별한다.
>
> - (임시) `X-USER-ID: <number>` 헤더를 사용한다.

---

## 🧱 Design Constraints (Fixed)

- Attendance 데이터는 **직접 수정 불가**
- 체크인/체크아웃은 **하루 기준 1회**
- 시간 기준은 **Asia/Seoul**
- 조회 시 반환되는 시간은 **Final 값**

(Contract §Core Principles, §Attendance, §Final View 참조)

---

## ✅ Final 합성 규칙 (승인된 최신 정정 1건)

- 조회 계열 응답은 **승인(APPROVED)된 최신 정정 요청 1건**만 반영한 “Final 값”을 반환한다.
- 최신 기준은 `processedAt desc` 이다.
- 승인된 정정이 없으면 원본 값을 반환한다.

> ✅ **구현 참고(SSOT)**
>
> Final 합성은 `AttendanceService`의 단일 경로(예: `toFinalSnapshot(...)`)를 통해 적용되어야 한다.
> 조회 엔드포인트가 추가/확장될 때도 **동일한 합성 경로를 재사용**해야 한다.

### 적용 범위(점검용)

아래 항목은 **모두 Final 합성 규칙을 적용**해야 한다.

- `GET /api/attendance/today`
- `GET /api/attendance` (목록: MVP 1차는 `month=YYYY-MM`만 우선 지원)
- `GET /api/attendance/{attendanceId}` (단건)

### 누락 방지 체크리스트(문서/코드 리뷰용)

- [ ] 새로 추가한 Attendance **조회** 엔드포인트가 `toFinalSnapshot(...)` 경로를 타는가?
- [ ] Final 최신 기준이 문서/코드 모두 `processedAt desc` 로 일치하는가?
- [ ] Final 응답에 `isCorrected` 및(존재 시) `appliedCorrectionRequestId`가 일관되게 반영되는가?

---

## 1. Check-in (출근)

### Endpoint

**POST** `/api/attendance/check-in`

---

### Description

- 당일 최초 출근을 기록한다.
- 사진 업로드는 필수이다.
- 근무 Site는 **서버에서 자동 결정**된다.

---

### Request (multipart/form-data)

> Check-in은 **multipart/form-data**로 전송한다.

#### Form Fields

| Field  | Type | Required | Description |
|--------|------|----------|-------------|
| photo  | file   | O | 출근 사진 파일 |

> ⚠️ `siteId`, `checkInAt` 등은 **요청으로 받지 않는다.**

> 업로드 제한(서버 검증): 이미지 파일만 허용(jpg/jpeg/png/webp/heic/heif), 최대 5MB

#### Example (curl)
```bash
curl -X POST "http://localhost:8080/api/attendance/check-in" \
  -H "X-USER-ID: 1" \
  -F "photo=@./example.png"
```

---

### Server-side Rules

- 당일 1회만 허용
- 미종료 Attendance가 있으면 거부
- `attendance.site_id = employee.site_id`
- `checkInAt = now(Asia/Seoul)`

---

### Success Response

**201 Created**

```json
{
  "attendanceId": 101,
  "workDate": "2026-01-18",
  "checkInAt": "2026-01-18T09:02:11+09:00",
  "checkOutAt": null,
  "isCorrected": false
}
```

---

### Error Codes

| HTTP | Code                    | Description              |
|------|-------------------------|--------------------------|
| 409  | ALREADY_CHECKED_IN      | 이미 출근 처리됨         |
| 409  | ALREADY_CHECKED_OUT     | 이미 퇴근 처리됨         |
| 409  | OPEN_ATTENDANCE_EXISTS  | 미종료 근태 존재         |
| 422  | INVALID_REQUEST_PAYLOAD | photo 누락/형식 오류/용량 초과 |
| 403  | EMPLOYEE_INACTIVE       | 비활성 직원              |
| 401  | UNAUTHORIZED            | 인증 필요/인증 정보 오류  |

---

## 2. Check-out (퇴근)

### Endpoint

**POST** `/api/attendance/check-out`

---

### Description

- 당일 출근한 Attendance를 종료한다.
- 체크인 이후 1회만 가능하다.

---

### Request (Auth Context)

> Check-out은 userId를 전달하지 않는다. (인증 컨텍스트에서 사용자 식별)

#### Example
`POST /api/attendance/check-out + Header: X-USER-ID: 1`

---

### Server-side Rules

- 체크인 없는 경우 거부
- 이미 체크아웃된 경우 거부
- `checkOutAt = now(Asia/Seoul)`

---

### Success Response

**200 OK**

```json
{
  "attendanceId": 101,
  "workDate": "2026-01-18",
  "checkInAt": "2026-01-18T09:02:11+09:00",
  "checkOutAt": "2026-01-18T18:01:03+09:00",
  "isCorrected": false
}
```

---

### Error Codes

| HTTP | Code                | Description      |
|------|---------------------|------------------|
| 409  | NOT_CHECKED_IN      | 출근 기록 없음   |
| 409  | ALREADY_CHECKED_OUT | 이미 퇴근 처리됨 |
| 403  | EMPLOYEE_INACTIVE   | 비활성 직원      |
| 401  | UNAUTHORIZED        | 인증 필요/인증 정보 오류 |

---

## 3. Today Attendance (오늘 상태 조회)

### Endpoint

**GET** `/api/attendance/today`

---

### Description

- 오늘 날짜(KST) 기준 근태 상태를 조회한다.
- 반환 시간은 **Final 값**이다.

---

### Response

```json
{
  "attendanceId": 101,
  "workDate": "2026-01-18",
  "checkInAt": "2026-01-18T09:02:11+09:00",
  "checkOutAt": null,
  "isCorrected": false
}
```

---

## 4. Attendance Read (단건 조회)

### Endpoint

**GET** `/api/attendance/{attendanceId}`

---

### Description

- Attendance 단건을 조회한다.
- 기본 반환 시간은 **Final 값**이다.

---

### Response

```json
{
  "attendanceId": 101,
  "employeeId": 5,
  "siteId": 10,
  "workDate": "2026-01-18",
  "checkInAt": "2026-01-18T09:00:00+09:00",
  "checkOutAt": "2026-01-18T18:00:00+09:00",
  "isCorrected": true,
  "appliedCorrectionRequestId": 55
}
```

---

### Notes

- `checkInAt` / `checkOutAt` 은 **Final 값**
- 승인된 정정이 없으면 원본 값 반환
- 권한 범위 외 접근 시 403

---

## 5. Attendance Read (목록 조회)

### Endpoint

**GET** `/api/attendance`

---

### Query Parameters

| Name       | Type   | Required | Description               |
|------------|--------|----------|---------------------------|
| month      | string | X        | YYYY-MM                   |
| from       | string | X        | YYYY-MM-DD                |
| to         | string | X        | YYYY-MM-DD                |
| siteId     | number | X        | Site 필터                 |
| employeeId | number | X        | 직원 필터 (ADMIN/MANAGER) |
| page       | number | X        | 페이지                    |
| size       | number | X        | 페이지 크기               |

---

### Description

- 권한 스코프에 따라 자동 필터링된다.
- 목록 조회에서도 **Final 값만 반환**한다.
- (MVP 1차) 현재는 `month(YYYY-MM)`만 우선 지원한다. (`from/to/siteId/employeeId`는 차기 버전에서 활성화)

---

### Response

```json
{
  "items": [
    {
      "attendanceId": 101,
      "workDate": "2026-01-18",
      "checkInAt": "2026-01-18T09:00:00+09:00",
      "checkOutAt": "2026-01-18T18:00:00+09:00",
      "isCorrected": true
    }
  ],
  "page": 1,
  "size": 20,
  "totalElements": 1
}
```

---

## 📌 Important Notes

- Attendance API는 **근태 원본의 유일한 생성 경로**이다.
- 시간/정책 계산, 정정 반영은 **조회 계층에서 합성**된다.
- 이 문서는 **설계 변경 제안을 포함하지 않는다.**

---

> **Any change to attendance behavior must start from the Contract.**
