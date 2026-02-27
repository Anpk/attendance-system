# Attendance Frontend (Next.js)

이 디렉토리는 **근태관리 웹앱 프로젝트의 프론트엔드(Next.js)** 입니다.  
모바일 환경에서도 사용 가능한 간단한 UX를 목표로 하며, 백엔드 API와의 계약을 준수합니다.

---

## Contract (Authoritative Specification)

> **주의**: 프론트엔드는 서버 계약(Contract)을 기준으로 동작해야 합니다.  
> UI/에러 처리/상태 갱신은 Spec 및 API 문서와 정합을 유지합니다.

- `docs/ATTENDANCE_SYSTEM_SPEC.md`  
  - 최상위 계약(SSOT)

- `docs/api/*`  
  - 구현 가이드(요청/응답/에러 포맷)

---

## Authentication (Implementation Note)

- (권장) `Authorization: Bearer <JWT>`
- (개발/호환) JWT가 없는 환경에서는 `X-USER-ID` 헤더를 사용할 수 있습니다.

---

## Environment Variables (필수)

이 프로젝트는 API 서버 주소를 **환경변수로 주입**받습니다.  
로컬 실행 전 아래 파일을 생성하세요.

### `.env.local` (frontend/attendance-frontend/.env.local)

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

로컬에서는 백엔드(Spring Boot) 서버도 함께 실행되어 있어야 합니다. (기본: 8080)

> `NEXT_PUBLIC_API_BASE_URL`이 설정되지 않으면 Attendance 페이지에서 안내 메시지가 표시되며 API 호출이 진행되지 않습니다.

---

## Getting Started

개발 서버 실행:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

브라우저에서 접속:

- `http://localhost:3000`

---

## 개발/운영 원칙 요약

- API Base URL은 **`NEXT_PUBLIC_API_BASE_URL` 단일 기준**으로 관리한다.
- 성공 응답 DTO 기반으로 **UI 상태를 즉시 갱신**한다(출근/퇴근 직후 today 상태 반영).
- 오류는 서버 표준 에러 포맷(6필드) 및 코드 체계를 기준으로 **사용자 안내 문구를 일관되게 처리**한다.
- 모바일 UX를 우선 고려한다(중복 클릭 방지, 처리 중 상태 표시 등).

## Backend (Spring Boot) - CORS 설정

백엔드의 CORS 허용 Origin은 환경변수로 제어합니다.

```bash
# 미설정 시 기본값: http://localhost:3000
export CORS_ALLOWED_ORIGINS=http://localhost:3000
```

---

> 이 문서 구조는 “설계 고정 → 구현 → 점검 → 확장” 흐름을 안전하게 유지하기 위한 것이다.
