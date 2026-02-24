import { apiFetch } from './client';
import type { AttendanceReportResponse } from './types';

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  return raw.replace(/\/+$/, '');
}

export async function fetchAttendanceReport(params: {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}): Promise<AttendanceReportResponse> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  return apiFetch<AttendanceReportResponse>(
    `${base}/api/attendance/report?${qs.toString()}`
  );
}
