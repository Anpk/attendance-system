# ATTENDANCE SYSTEM SPECIFICATION

## ⚠️ Contract Declaration

## 0-A. Naming Convention (Contract-Level)

### API Path Naming (Fixed)

- 도메인 모델 관점의 일반적인 명명 관행을 따른다.
- Attendance 도메인 API 경로는 **단수형**을 사용한다.
  - ✅ `/api/attendance/...`
  - ❌ `/api/attendances/...`

> 이 규칙은 Contract의 일부이며, 참조 문서(API docs)와 구현 코드는 반드시 이를 따른다.

This document is the authoritative contract for the Attendance Management System.  
All code, APIs, and database schemas **MUST comply** with this specification.  
Any deviation requires **explicit prior approval**.

---

## Metadata

- Spec Version: 1.0.1
- Status: **Frozen (MVP)**
- Created At: 2026-01-18
- Source: ChatGPT design session (master)

---

## 0. 이 문서의 사용 목적

이 문서는 **이미 확정된 설계 계약(Specification)** 이다.

- 새 채팅 세션에서 이 문서를 컨텍스트로 제공하면  
  **임의 재설계 없이 동일한 전제 하에서 개발/설계를 계속할 수 있다.**
- 설계 변경이 필요할 경우 **반드시 사용자에게 사전 확인**한다.
- 이 문서는 구현 참고 문서(API 문서)를 **대체하지 않으며**,  
  **상위 계약(Contract)** 으로서만 사용된다.

---

## 1. 프로젝트 전제 (고정)

### 범위

- MVP / 단일 회사
- 다회사(Multi-tenant)는 **차기 버전(MODE 3)** 에서 고려

### 구조

- 근태 스코프는 **Site(영업지점 / 고객사 파견처)** 단위
- 직원(Employee)은 **기본 소속 Site 1개**를 가진다
- 매니저(Manager)는 **여러 Site를 관리**할 수 있다

### 권한

- `EMPLOYEE | MANAGER | ADMIN`
- 정책 변경 및 조직 관리 권한은 **ADMIN만 가능**

#### 사용자 식별(인증 컨텍스트, 고정)

> 요청 파라미터/바디로 `userId`를 받지 않고, **인증 컨텍스트**에서 현재 사용자를 식별한다.
>
> - (권장) `Authorization: Bearer <JWT>`
>   - 토큰 검증 성공 시 서버는 인증 컨텍스트에 `userId`를 주입한다.
> - (개발/호환) JWT가 없는 환경에서는 (임시) `X-USER-ID: <number>` 헤더를 사용한다.
>
> 이 규칙은 Contract의 일부이며, API 문서 및 구현은 반드시 이를 따른다.

### UX (모바일 우선, 고정)

- 본 시스템은 **모바일 환경(모바일 브라우저)에서도 사용 가능**해야 한다.
- 출근/퇴근의 기본 플로우는 **복잡한 입력 없이 최소 상호작용으로 완료**되어야 한다.
  - 예: 출근 화면에서 “출근” → 사진 촬영/선택 → 완료(상태 즉시 반영)
  - 예: 출근 화면에서 “퇴근” → 완료(상태 즉시 반영)
- 출근(check-in)은 **사진 촬영/선택 기반 업로드 UX**를 우선 지원한다.
- 본 항목은 **UI/클라이언트 레이어의 고정 전제**이며,
  API 경로/도메인 규칙/에러 계약 등 **핵심 계약을 변경하지 않는다.**

---

## 2. 핵심 설계 원칙 (절대 변경 금지)

### Attendance 원본 불변

- 출퇴근 기록은 **직접 수정하지 않는다**

### 정정은 요청 기반

- 요청 → 승인 / 반려 → 조회 합성
- **승인된 정정만** 조회 결과에 반영
- 조회 시 **Final 값에만 적용**

### 승인 규칙

- **작성자 ≠ 승인자**
- 승인자 없을 경우 **ADMIN 백스톱**

### 기간 제한

- 정정 가능 기간은 **당월만 허용**

### 정책 사용 원칙

- 정책은 **계산(검증)에만 사용**
- Attendance / 정정 데이터를 **직접 변경하지 않는다**

---

## 3. Attendance (출퇴근)

### 생성

#### 체크인
- `POST /api/attendance/check-in`
- 당일 1회
- 사진 업로드 필수
- `attendance.site_id = employee.site_id` 자동 설정

#### 체크아웃
- `POST /api/attendance/check-out`
- 체크인 이후 1회
- 체크아웃 없이 재체크인 불가

### 기준

- 날짜 / 시간 기준: **Asia/Seoul**
- `workDate` 기준으로 “당일” 판단

---

## 4. 정정 프로세스 (Correction Request)

### 상태 전이

- `PENDING → APPROVED | REJECTED | CANCELED`
- 그 외 전이 **금지**

### 생성

- `POST /api/attendance/{attendanceId}/correction-requests`

#### 시간 검증
- 출근 < 퇴근
- 근무시간 ≤ 24h
- **당월만 허용**
- 동일 Attendance에 **PENDING 중복 금지**

### 목록 / Inbox

- `GET /api/correction-requests`

#### scope
- `approvable` (MANAGER Inbox)
- `requested_by_me`
- `for_me`
- `all` (ADMIN)

### 승인 / 반려

- `POST /api/correction-requests/{id}/approve`
- `POST /api/correction-requests/{id}/reject`
- 승인 시 **Final 정합성 재검증**
- **Site 스코프 + 작성자 ≠ 승인자**

### 취소

- `POST /api/correction-requests/{id}/cancel`
- 작성자만 가능 (PENDING만)
- **ADMIN 백스톱 허용**

---

## 5. 조회 합성 규칙 (Final 값)

Attendance 조회 시:

- `APPROVED` 상태 중 **최신 1건만 합성 적용**
- 합성 결과:
  - `checkInAt` / `checkOutAt` → Final 값
  - `originalCheckInAt` / `originalCheckOutAt` → 선택 제공
- `PENDING / REJECTED / CANCELED` 는 조회에 반영하지 않음

---

## 6. Attendance 조회 API

- `GET /api/attendance/{attendanceId}`
- `GET /api/attendance`
  - `month / from / to / siteId / employeeId`
- 권한 스코프는 **서버에서 강제**
- 기본 반환값은 **Final 값**

---

## 7. Admin 운영 관리 (ADMIN 전용)

### Site
- 생성 / 조회 / 수정 / 활성·비활성

### Employee
- 생성 / 조회 / 수정
- 기본 소속 Site 관리
- 비활성화 시 **출퇴근 불가**

### Manager
- 생성 / 조회 / 수정
- 비활성화 시 **승인 불가**

### Manager ↔ Site
- 매니저 승인 스코프 정의
- 승인자 없으면 **ADMIN 백스톱**

---

## 8. Policy (Site별, ADMIN만)

- Site당 정책 1개 (현재 정책)
- 지각 유예(`graceMinutes`) 등  
  **구체 필드는 API 문서 기준**
- 정책 변경은 **과거 데이터 재계산하지 않음** (MVP)

---

## 9. 공통 에러 규약

- 모든 에러 응답은 `docs/api/90-errors.md` 에 정의된  
  **표준 에러 포맷 및 에러 코드 계약을 따른다**

### 에러 처리 원칙

- 클라이언트 분기 기준은 **code**
- `409 / 422` → 업무 규칙 위반
- `500` → 시스템 장애

> 에러 응답 필드(`timestamp / status / error / code / message / path`)는  
> **90-errors.md가 단일 진실의 원천**이다.

---

## 10. 세션 이월 시 사용 방법 (권장)

아래 문서는 **이미 확정된 설계 계약이다.**  
이 문서를 기준으로 작업을 이어가되,  
**설계 변경이 필요하면 반드시 먼저 사용자에게 확인할 것.**

→ 이 문서 전체를 **새 세션의 첫 메시지로 전달**

---

## 11. 현재 상태 요약

- ✅ MVP 설계 완료
- ✅ API 계약 고정
- ✅ 정정 / 승인 / 합성 / 권한 정합성 확보
- ✅ 차기 버전 확장 포인트 명확
