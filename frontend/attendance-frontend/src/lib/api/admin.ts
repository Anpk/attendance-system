import { apiFetch } from './client';
import type {
  AdminEmployeeResponse,
  AdminEmployeeUpdateRequest,
  AdminManagerSiteAssignRequest,
  AdminSiteCreateRequest,
  AdminSiteResponse,
  AdminSiteUpdateRequest,
} from './types';

function getBaseUrl(): string {
  const baseUrlRaw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrlRaw) {
    // 기존 코드(AttendancePage)도 baseUrl 미설정 시 실제 요청이 깨질 수 있으므로
    // 여기서는 명시적으로 에러를 던져 조기 발견하도록 한다.
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');
  }
  // trailing slash 방지: "http://localhost:8080/" -> "http://localhost:8080"
  const normalized = baseUrlRaw.replace(/\/+$/, '');
  return normalized;
}

function authHeaders(userId: number) {
  return { 'X-USER-ID': String(userId) };
}

// -------------------------
// Sites
// -------------------------
export async function adminListSites(
  userId: number
): Promise<AdminSiteResponse[]> {
  const baseUrl = getBaseUrl();
  return apiFetch<AdminSiteResponse[]>(`${baseUrl}/api/admin/sites`, {
    headers: authHeaders(userId),
  });
}

export async function adminCreateSite(
  userId: number,
  body: AdminSiteCreateRequest
): Promise<AdminSiteResponse> {
  const baseUrl = getBaseUrl();
  return apiFetch<AdminSiteResponse>(`${baseUrl}/api/admin/sites`, {
    method: 'POST',
    headers: authHeaders(userId),
    body,
  });
}

export async function adminUpdateSite(
  userId: number,
  siteId: number,
  body: AdminSiteUpdateRequest
): Promise<AdminSiteResponse> {
  const baseUrl = getBaseUrl();
  return apiFetch<AdminSiteResponse>(`${baseUrl}/api/admin/sites/${siteId}`, {
    method: 'PATCH',
    headers: authHeaders(userId),
    body,
  });
}

// -------------------------
// Employees (ADMIN only)
// -------------------------
export async function adminListEmployees(
  userId: number
): Promise<AdminEmployeeResponse[]> {
  const baseUrl = getBaseUrl();
  return apiFetch<AdminEmployeeResponse[]>(`${baseUrl}/api/admin/employees`, {
    headers: authHeaders(userId),
  });
}

export async function adminUpdateEmployee(
  userId: number,
  targetUserId: number,
  body: AdminEmployeeUpdateRequest
): Promise<AdminEmployeeResponse> {
  const baseUrl = getBaseUrl();
  return apiFetch<AdminEmployeeResponse>(
    `${baseUrl}/api/admin/employees/${targetUserId}`,
    {
      method: 'PATCH',
      headers: authHeaders(userId),
      body,
    }
  );
}

// -------------------------
// Manager ↔ Site Assignments (ADMIN only)
// -------------------------
export async function adminAssignManagerSite(
  userId: number,
  body: AdminManagerSiteAssignRequest
): Promise<void> {
  const baseUrl = getBaseUrl();
  await apiFetch<void>(`${baseUrl}/api/admin/manager-site-assignments`, {
    method: 'POST',
    headers: authHeaders(userId),
    body,
  });
}

export async function adminRemoveManagerSite(
  userId: number,
  managerUserId: number,
  siteId: number
): Promise<void> {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams({
    managerUserId: String(managerUserId),
    siteId: String(siteId),
  });
  await apiFetch<void>(
    `${baseUrl}/api/admin/manager-site-assignments?${params.toString()}`,
    { method: 'DELETE', headers: authHeaders(userId) }
  );
}

export async function adminListManagerSites(
  userId: number,
  managerUserId: number
): Promise<number[]> {
  const baseUrl = getBaseUrl();
  return apiFetch<number[]>(
    `${baseUrl}/api/admin/manager-site-assignments/managers/${managerUserId}/sites`,
    { headers: authHeaders(userId) }
  );
}
