'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import AsyncButton from '@/app/_components/AsyncButton';
import type { CorrectionRequestListItem } from '@/app/_components/CorrectionRequestDetailModal';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/types';

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

  const [sitePick, setSitePick] = useState<string>(
    () => searchParams.get('site') ?? ''
  );
  const [userPick, setUserPick] = useState<string>(
    () => searchParams.get('user') ?? ''
  );
  const [fromPick, setFromPick] = useState<string>(
    () => searchParams.get('from') ?? ''
  ); // YYYY-MM-DD
  const [toPick, setToPick] = useState<string>(
    () => searchParams.get('to') ?? ''
  ); // YYYY-MM-DD

  const [siteApplied, setSiteApplied] = useState<string>(
    () => searchParams.get('site') ?? ''
  );
  const [userApplied, setUserApplied] = useState<string>(
    () => searchParams.get('user') ?? ''
  );
  const [fromApplied, setFromApplied] = useState<string>(
    () => searchParams.get('from') ?? ''
  );
  const [toApplied, setToApplied] = useState<string>(
    () => searchParams.get('to') ?? ''
  );

  const buildListUrl = useCallback(
    (
      nextTab: 'my' | 'approvable',
      nextFilters?: { site?: string; user?: string; from?: string; to?: string }
    ) => {
      const q = new URLSearchParams();
      q.set('tab', nextTab);

      const site = nextFilters?.site ?? '';
      const userId = nextFilters?.user ?? '';
      const from = nextFilters?.from ?? '';
      const to = nextFilters?.to ?? '';

      if (site) q.set('site', site);
      if (userId) q.set('user', userId);
      if (from) q.set('from', from);
      if (to) q.set('to', to);

      return `/corrections?${q.toString()}`;
    },
    []
  );

  const toListErrorMessage = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.httpStatus === 403 || e.code === 'FORBIDDEN') {
          return effectiveTab === 'approvable'
            ? '승인 가능한 목록 조회 권한이 없습니다.'
            : '정정 요청 목록 조회 권한이 없습니다.';
        }
        if (e.httpStatus >= 500) {
          return '서버 오류로 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        }
      }
      return `목록 조회에 실패했습니다. ${toUserMessage(e)}`;
    },
    [effectiveTab]
  );

  const fetchList = useCallback(async () => {
    if (!user) return;

    // ✅ URL이 approvable로 들어와도(직접 입력/즐겨찾기 등) 화면/호출 모두 my로 통일
    if (tab === 'approvable' && !isApprover) {
      router.replace(buildListUrl('my'));
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
      setError(toListErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [
    user,
    baseUrl,
    tab,
    isApprover,
    router,
    effectiveTab,
    toListErrorMessage,
    buildListUrl,
  ]);

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
      router.replace(buildListUrl('my'));
    }
  }, [user, isApprover, tab, router, buildListUrl]);

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

  useEffect(() => {
    if (!showFilterBar) {
      setSitePick('');
      setUserPick('');
      setFromPick('');
      setToPick('');
      setSiteApplied('');
      setUserApplied('');
      setFromApplied('');
      setToApplied('');
      return;
    }

    const qSite = searchParams.get('site') ?? '';
    const qUser = searchParams.get('user') ?? '';
    const qFrom = searchParams.get('from') ?? '';
    const qTo = searchParams.get('to') ?? '';

    setSitePick(qSite);
    setUserPick(qUser);
    setFromPick(qFrom);
    setToPick(qTo);

    setSiteApplied(qSite);
    setUserApplied(qUser);
    setFromApplied(qFrom);
    setToApplied(qTo);
  }, [showFilterBar, searchParams]);

  function switchTab(next: 'my' | 'approvable') {
    // ✅ 비승인자는 approvable로 전환 불가(표시/접근 일관성)
    if (next === 'approvable' && !isApprover) {
      router.replace(buildListUrl('my'));
      return;
    }

    // URL로 탭 상태 유지(뒤로가기 UX 포함)
    setStatusFilter('ALL');
    setSitePick('');
    setUserPick('');
    setSiteApplied('');
    setUserApplied('');
    setFromPick('');
    setToPick('');
    setFromApplied('');
    setToApplied('');
    router.replace(buildListUrl(next));
  }

  async function applyFilters() {
    setSiteApplied(sitePick);
    setUserApplied(userPick);
    setFromApplied(fromPick);
    setToApplied(toPick);
    router.replace(
      buildListUrl(effectiveTab, {
        site: sitePick,
        user: userPick,
        from: fromPick,
        to: toPick,
      })
    );
    await fetchList();
  }

  const hasAppliedFilters = useMemo(() => {
    return !!(siteApplied || userApplied || fromApplied || toApplied);
  }, [siteApplied, userApplied, fromApplied, toApplied]);

  async function resetFilters() {
    setSitePick('');
    setUserPick('');
    setFromPick('');
    setToPick('');

    setSiteApplied('');
    setUserApplied('');
    setFromApplied('');
    setToApplied('');

    router.replace(buildListUrl(effectiveTab));
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

      // ✅ 기간 필터(요청 시각 기준, 운영용)
      const fromMs = fromApplied
        ? new Date(`${fromApplied}T00:00:00+09:00`).getTime()
        : null;
      const toMs = toApplied
        ? new Date(`${toApplied}T23:59:59+09:00`).getTime()
        : null;
      if (fromMs || toMs) {
        filtered = filtered.filter((it) => {
          const requestedAt = getOptionalStringField(it, 'requestedAt');
          if (!requestedAt) return true;
          const ms = new Date(requestedAt).getTime();
          if (!Number.isFinite(ms)) return true;
          if (fromMs && ms < fromMs) return false;
          if (toMs && ms > toMs) return false;
          return true;
        });
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
    fromApplied,
    toApplied,
    employeeByUserId,
  ]);

  const buildDetailHref = useCallback(
    (requestId: number) => {
      const q = new URLSearchParams();
      q.set('tab', effectiveTab);

      if (showFilterBar) {
        if (siteApplied) q.set('site', siteApplied);
        if (userApplied) q.set('user', userApplied);
        if (fromApplied) q.set('from', fromApplied);
        if (toApplied) q.set('to', toApplied);
      }

      return `/corrections/${requestId}?${q.toString()}`;
    },
    [effectiveTab, showFilterBar, siteApplied, userApplied, fromApplied, toApplied]
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정</h1>
          <AsyncButton
            type="button"
            onClick={fetchList}
            loading={loading}
            loadingText="갱신 중..."
            showSpinner
            className="rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            새로고침
          </AsyncButton>
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
            <div className="grid gap-3 md:grid-cols-4">
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

              <label className="text-xs text-gray-800 dark:text-gray-200">
                <span className="block mb-1">기간 From</span>
                <input
                  type="date"
                  className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100"
                  value={fromPick}
                  onChange={(e) => setFromPick(e.target.value)}
                  disabled={loading}
                />
              </label>

              <label className="text-xs text-gray-800 dark:text-gray-200">
                <span className="block mb-1">기간 To</span>
                <input
                  type="date"
                  className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100"
                  value={toPick}
                  onChange={(e) => setToPick(e.target.value)}
                  disabled={loading}
                />
              </label>

              {/* action controls moved below */}
            </div>
            <p className="mt-2 text-xs text-gray-700 dark:text-gray-200">
              ※ 관리자/매니저만 근무지/직원 필터를 사용할 수 있습니다.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <AsyncButton
                type="button"
                onClick={applyFilters}
                loading={loading}
                showSpinner
                className="min-w-[92px] whitespace-nowrap rounded border border-gray-400 bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                조회
              </AsyncButton>

              <button
                type="button"
                onClick={resetFilters}
                className="min-w-[92px] whitespace-nowrap rounded border border-gray-400 bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                disabled={loading}
              >
                초기화
              </button>

              {hasAppliedFilters && (
                <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
                  적용됨
                </span>
              )}
            </div>
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
          <section
            className="mt-4 rounded border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-900"
            aria-busy="true"
          >
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-500 border-r-transparent dark:border-gray-300 dark:border-r-transparent" />
              목록 불러오는 중...
            </div>
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={`correction-skeleton-${i}`}
                  className="animate-pulse rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950"
                >
                  <div className="h-4 w-28 rounded bg-gray-300 dark:bg-gray-700" />
                  <div className="mt-2 h-3 w-full rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {!loading && error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={fetchList}
              className="mt-2 rounded border border-red-400 bg-white px-3 py-1.5 text-xs text-red-900 hover:bg-red-100 dark:border-red-500 dark:bg-gray-900 dark:text-red-200 dark:hover:bg-red-900/30"
              disabled={loading}
            >
              다시 시도
            </button>
          </div>
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
                const targetUserId = getTargetUserId(it);
                const targetEmployee = employeeByUserId.get(targetUserId);
                const targetEmployeeLabel = targetEmployee?.username
                  ? `${targetEmployee.username} #${targetUserId}`
                  : `#${targetUserId}`;
                const summaryParts = [
                  `대상 직원 ${targetEmployeeLabel}`,
                  `대상 날짜 ${workDate ?? '-'}`,
                  `요청 시각 ${fmtYmdHm(requestedAt)}`,
                ];

                return (
                  <li key={it.requestId} className="px-4 py-3 text-sm">
                    <Link
                      href={buildDetailHref(it.requestId)}
                      className="block w-full rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">
                              요청 #{it.requestId}
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            {summaryParts.join(' · ')}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span
                              className={`rounded px-2 py-1 text-xs ${badgeClass(String(it.status))}`}
                            >
                              {statusLabel(String(it.status))}
                            </span>

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
