'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import type { CorrectionRequestListItem } from '@/app/_components/CorrectionRequestDetailModal';
import { apiFetch } from '@/lib/api/client';

import { toUserMessage } from '@/lib/api/error-messages';

function badgeClass(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100';
    case 'APPROVED':
      return 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-100';
    case 'REJECTED':
      return 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-100';
    case 'CANCELED':
      return 'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100';
    default:
      return 'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return '승인 대기 중';
    case 'APPROVED':
      return '승인됨';
    case 'REJECTED':
      return '반려됨';
    case 'CANCELED':
      return '취소됨';
    default:
      return status;
  }
}

function fmtYmdHm(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

function getOptionalStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

type CorrectionRequestListResponse = {
  items: CorrectionRequestListItem[];
  page: number;
  size: number;
  totalElements: number;
};

type SiteOption = { siteId: number; name: string; active: boolean };

type EmployeeOption = {
  userId: number;
  username?: string;
  role?: string;
  active?: boolean;
  siteId: number;
};

function getTargetUserId(it: CorrectionRequestListItem): number {
  const anyIt = it as unknown as Record<string, unknown>;
  const candidates = [
    anyIt['targetUserId'],
    anyIt['employeeUserId'],
    anyIt['userId'],
    anyIt['requestedBy'],
  ];
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return Number(it.requestedBy);
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

function toEpochMillis(iso: string | null, fallback: number): number {
  if (!iso) return fallback;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : fallback;
}

function CorrectionsPageInner() {
  const { user } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ 승인자만 승인 대기 탭 노출 (프론트 가드)
  // - role 기반만 사용 (최소/명확): MANAGER/ADMIN만 approvable 탭 접근 가능
  const isApprover = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  // tab=my | approvable (기본 my)
  const tab = searchParams.get('tab') === 'approvable' ? 'approvable' : 'my';

  // ✅ 실제 동작 기준 탭(권한 기반): 비승인자는 항상 my로 강제
  const effectiveTab: 'my' | 'approvable' = !isApprover ? 'my' : tab;

  // 기존 정책 유지(최소 diff): env 없으면 localhost fallback
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

  const [items, setItems] = useState<CorrectionRequestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [sitePick, setSitePick] = useState<string>('');
  const [userPick, setUserPick] = useState<string>('');

  const [siteApplied, setSiteApplied] = useState<string>('');
  const [userApplied, setUserApplied] = useState<string>('');

  const fetchList = useCallback(async () => {
    if (!user) return;

    // ✅ URL이 approvable로 들어와도(직접 입력/즐겨찾기 등) 화면/호출 모두 my로 통일
    if (tab === 'approvable' && !isApprover) {
      router.replace('/corrections?tab=my');
    }

    setLoading(true);
    setError('');
    try {
      // 계약: 탭에 따라 scope 변경
      // - 내 정정 요청: scope=requested_by_me
      // - 정정 승인 대기: scope=approvable&status=PENDING
      const url =
        effectiveTab === 'my'
          ? `${baseUrl}/api/correction-requests?scope=requested_by_me&page=0&size=50`
          : `${baseUrl}/api/correction-requests?scope=approvable&status=PENDING&page=0&size=50`;

      const data = await apiFetch<CorrectionRequestListResponse>(url);
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user, baseUrl, tab, isApprover, router, effectiveTab]);

  useEffect(() => {
    if (!user) return;
    if (!isApprover) return;

    (async () => {
      try {
        const [s, e] = await Promise.all([
          apiFetch<SiteOption[]>(`${baseUrl}/api/admin/sites`),
          apiFetch<EmployeeOption[]>(`${baseUrl}/api/admin/employees`),
        ]);
        setSites(Array.isArray(s) ? s : []);
        setEmployees(Array.isArray(e) ? e : []);
      } catch {
        setSites([]);
        setEmployees([]);
      }
    })();
  }, [user, isApprover, baseUrl]);

  useEffect(() => {
    if (!user) return;
    fetchList();
  }, [user, fetchList]);

  useEffect(() => {
    if (!user) return;

    // ✅ 비승인자가 URL로 approvable 탭에 직접 접근하면 my 탭으로 되돌림
    if (!isApprover && tab === 'approvable') {
      router.replace('/corrections?tab=my');
    }
  }, [user, isApprover, tab, router]);

  const employeeByUserId = useMemo(() => {
    const m = new Map<number, EmployeeOption>();
    for (const e of employees) m.set(Number(e.userId), e);
    return m;
  }, [employees]);

  // ✅ 관리자/매니저는 출퇴근 입력 대상이 아니므로 직원 필터 대상에서 제외
  const filterEligibleEmployees = useMemo(() => {
    return employees.filter((e) => String(e.role) === 'EMPLOYEE');
  }, [employees]);

  const userOptions = useMemo(() => {
    const sid = sitePick ? Number(sitePick) : null;
    const list = sid
      ? filterEligibleEmployees.filter((e) => Number(e.siteId) === sid)
      : filterEligibleEmployees;
    return [...list].sort((a, b) => Number(a.userId) - Number(b.userId));
  }, [filterEligibleEmployees, sitePick]);

  const showFilterBar =
    effectiveTab === 'approvable' || (effectiveTab === 'my' && isApprover);

  function switchTab(next: 'my' | 'approvable') {
    // ✅ 비승인자는 approvable로 전환 불가(표시/접근 일관성)
    if (next === 'approvable' && !isApprover) {
      router.replace('/corrections?tab=my');
      return;
    }

    // URL로 탭 상태 유지(뒤로가기 UX 포함)
    setStatusFilter('ALL');
    setSitePick('');
    setUserPick('');
    setSiteApplied('');
    setUserApplied('');
    const q = next === 'approvable' ? '?tab=approvable' : '?tab=my';
    router.replace(`/corrections${q}`);
  }

  async function applyFilters() {
    setSiteApplied(sitePick);
    setUserApplied(userPick);
    await fetchList();
  }

  const displayedItems = useMemo(() => {
    // ✅ 목록 UX 보강(최소): 상태 필터 + 요청시각 내림차순 정렬
    // - 서버 정렬/필터가 아직 없다면 클라이언트에서 1차 대응
    const statusFiltered =
      effectiveTab === 'my' && statusFilter !== 'ALL'
        ? items.filter((it) => String(it.status) === statusFilter)
        : items;

    let filtered = statusFiltered;

    if (showFilterBar) {
      const sid = siteApplied ? Number(siteApplied) : null;
      const uid = userApplied ? Number(userApplied) : null;

      if (sid) {
        filtered = filtered.filter((it) => {
          const tu = getTargetUserId(it);
          const emp = employeeByUserId.get(tu);
          return emp ? Number(emp.siteId) === sid : false;
        });
      }
      if (uid) {
        filtered = filtered.filter((it) => getTargetUserId(it) === uid);
      }
    }

    // requestedAt이 없을 수 있으므로 requestId로 fallback(내림차순)
    return [...filtered].sort((a, b) => {
      const aRequestedAt = getOptionalStringField(a, 'requestedAt');
      const bRequestedAt = getOptionalStringField(b, 'requestedAt');

      const aKey = toEpochMillis(aRequestedAt, Number(a.requestId) || 0);
      const bKey = toEpochMillis(bRequestedAt, Number(b.requestId) || 0);

      return bKey - aKey;
    });
  }, [
    items,
    effectiveTab,
    statusFilter,
    showFilterBar,
    siteApplied,
    userApplied,
    employeeByUserId,
  ]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정</h1>
          <button
            type="button"
            onClick={fetchList}
            className="rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? '갱신 중...' : '새로고침'}
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => switchTab('my')}
            className={`rounded px-3 py-2 text-sm ${
              effectiveTab === 'my'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
            }`}
            disabled={loading}
          >
            내가 요청한 목록
          </button>
          {isApprover && (
            <button
              type="button"
              onClick={() => switchTab('approvable')}
              className={`rounded px-3 py-2 text-sm ${
                effectiveTab === 'approvable'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
              }`}
              disabled={loading}
            >
              승인 가능한 목록
            </button>
          )}
        </div>

        {showFilterBar && (
          <section className="mt-3 rounded border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-900">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-gray-800 dark:text-gray-200">
                <span className="block mb-1">근무지</span>
                <select
                  className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100"
                  value={sitePick}
                  onChange={(e) => {
                    setSitePick(e.target.value);
                    setUserPick('');
                  }}
                  disabled={loading || sites.length === 0}
                >
                  <option value="">전체</option>
                  {sites.map((s) => (
                    <option key={s.siteId} value={String(s.siteId)}>
                      {s.name} (#{s.siteId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-gray-800 dark:text-gray-200">
                <span className="block mb-1">직원</span>
                <select
                  className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100"
                  value={userPick}
                  onChange={(e) => setUserPick(e.target.value)}
                  disabled={loading || filterEligibleEmployees.length === 0}
                >
                  <option value="">전체</option>
                  {userOptions.map((u) => (
                    <option key={u.userId} value={String(u.userId)}>
                      {u.username ? `${u.username} ` : ''}#{u.userId}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyFilters}
                  className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                  disabled={loading}
                  aria-busy={loading}
                >
                  조회
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-700 dark:text-gray-200">
              ※ 관리자/매니저만 근무지/직원 필터를 사용할 수 있습니다.
            </p>
          </section>
        )}

        {effectiveTab === 'my' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['ALL', '전체'],
                ['PENDING', '승인 대기'],
                ['APPROVED', '승인됨'],
                ['REJECTED', '반려됨'],
                ['CANCELED', '취소됨'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded px-3 py-2 text-xs ${
                  statusFilter === value
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                }`}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p
            className="mt-4 text-sm text-gray-600 dark:text-gray-300"
            aria-busy="true"
          >
            목록 불러오는 중...
          </p>
        )}

        {!loading && error && (
          <p className="mt-4 text-sm text-red-600">❌ {error}</p>
        )}

        {!loading && !error && displayedItems.length === 0 && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {effectiveTab === 'my'
              ? '표시할 정정 요청이 없습니다.'
              : '승인 대기 요청이 없습니다.'}
          </p>
        )}

        {!loading && !error && displayedItems.length > 0 && (
          <section className="mt-4 rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
            <ul className="divide-y dark:divide-gray-700">
              {displayedItems.map((it) => {
                const requestedAt = getOptionalStringField(it, 'requestedAt');
                const workDate = getOptionalStringField(it, 'workDate');

                return (
                  <li key={it.requestId} className="px-4 py-3 text-sm">
                    <Link
                      href={
                        effectiveTab === 'approvable'
                          ? `/corrections/${it.requestId}?tab=approvable`
                          : `/corrections/${it.requestId}?tab=my`
                      }
                      className="block w-full rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">
                              요청 #{it.requestId}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-300">
                              {fmtYmdHm(requestedAt)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span
                              className={`rounded px-2 py-1 text-xs ${badgeClass(String(it.status))}`}
                            >
                              {statusLabel(String(it.status))}
                            </span>

                            {workDate ? (
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                대상 날짜 {workDate}
                              </span>
                            ) : null}

                            {effectiveTab === 'approvable' ? (
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                요청자 ID {it.requestedBy}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-300">
                          상세 보기
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

export default function CorrectionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CorrectionsPageInner />
    </Suspense>
  );
}
