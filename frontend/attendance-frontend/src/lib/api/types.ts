export type EmployeeRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type AuthLoginRequest = {
  userId: number;
  password: string;
};

export type AuthLoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

export type AuthMeResponse = {
  userId: number;
  role: EmployeeRole;
  active: boolean;
  siteId: number;
};

export type ApiErrorResponse = {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
};

export class ApiError extends Error {
  public readonly httpStatus: number;
  public readonly code: string;
  public readonly path?: string;
  public readonly raw?: unknown;

  constructor(params: {
    message: string;
    httpStatus: number;
    code: string;
    path?: string;
    raw?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.httpStatus = params.httpStatus;
    this.code = params.code;
    this.path = params.path;
    this.raw = params.raw;
  }
}

export type AttendanceActionResponse = {
  attendanceId: number | null;
  workDate: string; // "YYYY-MM-DD"
  checkInAt: string | null; // ISO with +09:00
  checkOutAt: string | null; // ISO with +09:00
  isCorrected: boolean;
};

export type AttendanceStatus = {
  id: number;
  checkInTime: string;
  checkOutTime: string | null;
} | null;

// 월별 근태 목록(이력) 조회 응답
export type AttendanceListItemResponse = {
  attendanceId: number;
  workDate: string; // "YYYY-MM-DD"
  checkInAt: string | null;
  checkOutAt: string | null;
  isCorrected: boolean;
};

export type AttendanceListResponse = {
  items: AttendanceListItemResponse[];
  page: number;
  size: number;
  totalElements: number;
};

// =========================
// Attendance Report (MVP)
// =========================

export type AttendanceReportItemResponse = {
  attendanceId: number;
  workDate: string; // YYYY-MM-DD
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number | null;
  isCorrected: boolean;
};

export type AttendanceReportResponse = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  totalDays: number;
  totalWorkMinutes: number;
  items: AttendanceReportItemResponse[];
};

// =========================
// Admin Ops DTO (MVP)
// =========================

export type AdminSiteResponse = {
  siteId: number;
  name: string;
  active: boolean;
};

export type AdminSiteCreateRequest = {
  name: string;
};

export type AdminSiteUpdateRequest = {
  name?: string | null;
  active?: boolean | null;
};

export type AdminEmployeeResponse = {
  userId: number;
  active: boolean;
  role: EmployeeRole;
  siteId: number;
};

export type AdminEmployeeCreateRequest = {
  userId: number;
  username: string;
  password: string;
  role: EmployeeRole;
  siteId: number;
};

export type AdminEmployeeUpdateRequest = {
  active?: boolean | null;
  username?: string | null;
  siteId?: number | null;
};

export type AdminManagerSiteAssignRequest = {
  managerUserId: number;
  siteId: number;
};
