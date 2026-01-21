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
  attendanceId: number;
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

export type TodayAttendanceResponse = {
  checkedIn: boolean;
  checkedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
};
