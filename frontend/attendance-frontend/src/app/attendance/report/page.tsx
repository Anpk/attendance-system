'use client';

import AppHeader from '@/app/_components/AppHeader';
import CorrectionRequestModal from '@/app/_components/CorrectionRequestModal';
import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';
import { toUserMessage } from '@/lib/api/error-messages';
import { fetchAttendanceReport } from '@/lib/api/attendance-report';
import { adminListSites } from '@/lib/api/admin';
import type {
  AttendanceReportResponse,
  AdminSiteResponse,
  EmployeeRole,
} from '@/lib/api/types';
import ReportTab from '@/app/admin/sites/_components/ReportTab';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatIsoToHm(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // fallback
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function csvEscape(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AttendanceReportPageInner() {
  const { user, ready, forbidden } = useRequireAuth();
  const { message, setFlashMessage, clearMessage } = useFlashMessage();

  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const role = (user?.role ?? 'EMPLOYEE') as EmployeeRole;
  const isEmployee = role === 'EMPLOYEE';
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';

  const defaults = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYmdLocal(from), to: toYmdLocal(now) };
  }, []);

  const [from, setFrom] = useState<string>(defaults.from);
  const [to, setTo] = useState<string>(defaults.to);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AttendanceReportResponse | null>(null);
  const [adminSites, setAdminSites] = useState<AdminSiteResponse[]>([]);

  const [onlyMissingCheckout, setOnlyMissingCheckout] = useState(false);
  const [onlyCorrected, setOnlyCorrected] = useState(false);

  const [applySummaryFilter, setApplySummaryFilter] = useState(true);
  const [autoLoad, setAutoLoad] = useState(false);

  const [selectedAttendance, setSelectedAttendance] = useState<{
    attendanceId: number;
    workDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null>(null);
  const [toast, setToast] = useState<string>('');
  const loadSeqRef = useRef(0);
  const lastLoadedRef = useRef<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const invalidRange = useMemo(() => {
    if (!from || !to) return false;
    // YYYY-MM-DD는 문자열 비교로도 안전
    return from > to;
  }, [from, to]);

  const quickPreset = useMemo(() => {
    if (!from || !to)
      return null as
        | 'today'
        | 'week'
        | 'thisMonth'
        | 'prevMonth'
        | 'nextMonth'
        | null;

    const now = new Date();
    const today = toYmdLocal(now);
    if (from === today && to === today) return 'today';

    // 이번주(월~일) 기준은 "현재 날짜"로
    const day = now.getDay();
    const diffToMon = (day + 6) % 7;
    const mon = addDays(now, -diffToMon);
    const sun = addDays(mon, 6);
    if (from === toYmdLocal(mon) && to === toYmdLocal(sun)) return 'week';

    // 이번달(현재 날짜 기준)
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (
      from === toYmdLocal(firstThisMonth) &&
      to === toYmdLocal(lastThisMonth)
    ) {
      return 'thisMonth';
    }

    // 지난달/다음달은 "현재 선택된 from" 기준
    const base = new Date(from + 'T00:00:00');
    const firstBase = new Date(base.getFullYear(), base.getMonth(), 1);

    const lastPrev = new Date(firstBase);
    lastPrev.setDate(0);
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    if (from === toYmdLocal(firstPrev) && to === toYmdLocal(lastPrev))
      return 'prevMonth';

    const firstNext = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const lastNext = new Date(base.getFullYear(), base.getMonth() + 2, 0);
    if (from === toYmdLocal(firstNext) && to === toYmdLocal(lastNext))
      return 'nextMonth';

    return null;
  }, [from, to]);

  const isDirty = useMemo(() => {
    if (autoLoad) return false;
    const last = lastLoadedRef.current;
    if (!last) return false;
    return last.from !== from || last.to !== to;
  }, [autoLoad, from, to]);

  // 자동 조회(필터 변경 시): from/to 변경을 약간 지연 후 조회
  useEffect(() => {
    if (!autoLoad) return;
    if (!ready) return;
    if (!user) return;
    if (!isEmployee) return;
    if (!from || !to) return;
    if (from > to) return;

    const t = setTimeout(() => {
      void load({ from, to });
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, from, to, ready, user, isEmployee]);

  const displayedItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((x) => {
      if (onlyMissingCheckout && x.workMinutes != null) return false;
      if (onlyCorrected && !x.isCorrected) return false;
      return true;
    });
  }, [data, onlyMissingCheckout, onlyCorrected]);

  const summaryBaseItems = useMemo(() => {
    if (!data) return [];
    return applySummaryFilter ? displayedItems : data.items;
  }, [data, applySummaryFilter, displayedItems]);

  const summary = useMemo(() => {
    if (!data) {
      return {
        correctedCount: 0,
        correctedRatePct: 0,
        missingCheckoutCount: 0,
        missingCheckoutRatePct: 0,
        validWorkDays: 0,
        totalWorkMinutes: 0,
      };
    }

    const baseItems = summaryBaseItems;
    const totalDays = baseItems.length;
    const correctedCount = baseItems.filter((x) => x.isCorrected).length;
    const missingCheckoutCount = baseItems.filter(
      (x) => x.checkInAt != null && x.checkOutAt == null
    ).length;
    const validWorkDays = baseItems.filter((x) => x.workMinutes != null).length;

    const correctedRatePct =
      totalDays > 0 ? Math.round((correctedCount / totalDays) * 100) : 0;
    const missingCheckoutRatePct =
      totalDays > 0 ? Math.round((missingCheckoutCount / totalDays) * 100) : 0;

    const totalWorkMinutes = applySummaryFilter
      ? baseItems.reduce((acc, x) => acc + (x.workMinutes ?? 0), 0)
      : data.totalWorkMinutes;

    return {
      correctedCount,
      correctedRatePct,
      missingCheckoutCount,
      missingCheckoutRatePct,
      validWorkDays,
      totalWorkMinutes,
    };
  }, [data, summaryBaseItems, applySummaryFilter]);

  async function load(override?: { from: string; to: string }) {
    if (!ready) return;
    if (!user) return;

    const effectiveFrom = override?.from ?? from;
    const effectiveTo = override?.to ?? to;

    if (!effectiveFrom || !effectiveTo) {
      setFlashMessage('시작일/종료일을 입력해 주세요.');
      return;
    }
    if (effectiveFrom > effectiveTo) {
      setFlashMessage('시작일은 종료일보다 이후일 수 없습니다.');
      return;
    }

    const mySeq = ++loadSeqRef.current;

    setLoading(true);
    clearMessage();
    try {
      const res = await fetchAttendanceReport({
        from: effectiveFrom,
        to: effectiveTo,
      });
      if (mySeq !== loadSeqRef.current) return;
      setData(res);
      lastLoadedRef.current = { from: effectiveFrom, to: effectiveTo };
    } catch (e) {
      if (mySeq !== loadSeqRef.current) return;
      setData(null);
      setFlashMessage(toUserMessage(e));
    } finally {
      if (mySeq === loadSeqRef.current) setLoading(false);
    }
  }

  function setRangeAndMaybeLoad(nf: string, nt: string) {
    setFrom(nf);
    setTo(nt);
    // 빠른 선택 버튼은 즉시 조회까지 수행
    void load({ from: nf, to: nt });
  }

  function resetFilters() {
    setFrom(defaults.from);
    setTo(defaults.to);
    setOnlyMissingCheckout(false);
    setOnlyCorrected(false);
    setApplySummaryFilter(true);
    setToast('');
    clearMessage();
    setData(null);
    void load({ from: defaults.from, to: defaults.to });
  }

  function downloadCsv(kind: 'all' | 'displayed') {
    if (!data) {
      setFlashMessage('조회 후 다운로드할 수 있습니다.');
      return;
    }
    const items = kind === 'all' ? data.items : displayedItems;
    if (items.length === 0) {
      setFlashMessage('다운로드할 항목이 없습니다.');
      return;
    }

    const header = [
      'userId',
      'role',
      'workDate',
      'checkIn',
      'checkOut',
      'workMinutes',
      'isCorrected',
    ];
    const myUserId = user ? String(user.userId) : '';
    const myRole = user ? String(user.role) : '';

    const rows = items.map((x) => {
      const checkIn = x.checkInAt ? formatIsoToHm(x.checkInAt) : '';
      const checkOut = x.checkOutAt ? formatIsoToHm(x.checkOutAt) : '';
      const mins = x.workMinutes == null ? '' : String(x.workMinutes);
      const corrected = x.isCorrected ? 'Y' : 'N';
      return [myUserId, myRole, x.workDate, checkIn, checkOut, mins, corrected]
        .map(csvEscape)
        .join(',');
    });

    // UTF-8 BOM for Excel
    const bom = '\uFEFF';
    const csv = bom + header.join(',') + '\n' + rows.join('\n') + '\n';

    const safeFrom = (data.from ?? from).replace(/[^0-9-]/g, '');
    const safeTo = (data.to ?? to).replace(/[^0-9-]/g, '');
    const safeUserId = myUserId.replace(/[^0-9]/g, '') || 'unknown';
    const suffix = kind === 'all' ? 'all' : 'displayed';
    const filename = `attendance-report_${suffix}_user-${safeUserId}_${safeFrom}_to_${safeTo}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    setFlashMessage('CSV 다운로드를 시작했습니다.');
  }

  // 최초 진입 시 자동 로드
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (!isEmployee) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, isEmployee]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (!isAdminOrManager) return;

    let cancelled = false;
    (async () => {
      try {
        const s = await adminListSites();
        if (!cancelled) setAdminSites(s);
      } catch (e) {
        if (!cancelled) setFlashMessage(toUserMessage(e));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, forbidden, isAdminOrManager]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            근태 리포트
          </h1>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            기간(시작일~종료일) 동안의 근무일/총 근무시간을 확인합니다.
          </div>
        </div>

        {ready && forbidden && (
          <div className="mb-4 rounded border bg-white p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            권한이 없습니다.
          </div>
        )}

        {message && (
          <div className="mb-4 rounded border bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            {message}
          </div>
        )}

        {!forbidden && toast && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/30 dark:text-green-200">
            ✅ {toast}
          </div>
        )}

        {!forbidden && isAdminOrManager && (
          <div className="mb-4">
            <ReportTab
              user={
                user
                  ? { userId: user.userId, role: user.role as EmployeeRole }
                  : null
              }
              ready={ready}
              forbidden={forbidden}
              sites={adminSites}
              setFlashMessage={setFlashMessage}
            />
          </div>
        )}

        {!forbidden && isEmployee && (
          <section className="mb-4 rounded border border-gray-300 bg-white p-4 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                빠른 선택
              </div>
              {loading && (
                <span className="ml-1 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-200">
                  조회 중…
                </span>
              )}

              <button
                type="button"
                className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  quickPreset === 'today'
                    ? 'border-gray-700 bg-gray-200 text-gray-900 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100'
                    : 'border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
                }`}
                disabled={loading}
                onClick={() => {
                  const now = new Date();
                  const nf = toYmdLocal(now);
                  const nt = toYmdLocal(now);
                  setRangeAndMaybeLoad(nf, nt);
                }}
              >
                오늘
              </button>

              <button
                type="button"
                className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  quickPreset === 'week'
                    ? 'border-gray-700 bg-gray-200 text-gray-900 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100'
                    : 'border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
                }`}
                disabled={loading}
                onClick={() => {
                  const now = new Date();
                  // 이번주(월~일)
                  const day = now.getDay();
                  const diffToMon = (day + 6) % 7;
                  const mon = addDays(now, -diffToMon);
                  const sun = addDays(mon, 6);
                  const nf = toYmdLocal(mon);
                  const nt = toYmdLocal(sun);
                  setRangeAndMaybeLoad(nf, nt);
                }}
              >
                이번주
              </button>

              <button
                type="button"
                className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  quickPreset === 'thisMonth'
                    ? 'border-gray-700 bg-gray-200 text-gray-900 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100'
                    : 'border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
                }`}
                disabled={loading}
                onClick={() => {
                  const now = new Date();
                  const firstThisMonth = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                  );
                  const lastThisMonth = new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    0
                  );
                  const nf = toYmdLocal(firstThisMonth);
                  const nt = toYmdLocal(lastThisMonth);
                  setRangeAndMaybeLoad(nf, nt);
                }}
              >
                이번달
              </button>

              <button
                type="button"
                className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  quickPreset === 'prevMonth'
                    ? 'border-gray-700 bg-gray-200 text-gray-900 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100'
                    : 'border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
                }`}
                disabled={loading}
                onClick={() => {
                  const base = from ? new Date(from + 'T00:00:00') : new Date();
                  const firstThis = new Date(
                    base.getFullYear(),
                    base.getMonth(),
                    1
                  );
                  const lastPrev = new Date(firstThis);
                  lastPrev.setDate(0);
                  const firstPrev = new Date(
                    lastPrev.getFullYear(),
                    lastPrev.getMonth(),
                    1
                  );
                  const nf = toYmdLocal(firstPrev);
                  const nt = toYmdLocal(lastPrev);
                  setRangeAndMaybeLoad(nf, nt);
                }}
              >
                지난달
              </button>

              <button
                type="button"
                className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  quickPreset === 'nextMonth'
                    ? 'border-gray-700 bg-gray-200 text-gray-900 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100'
                    : 'border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
                }`}
                disabled={loading}
                onClick={() => {
                  const base = from ? new Date(from + 'T00:00:00') : new Date();
                  const firstNextMonth = new Date(
                    base.getFullYear(),
                    base.getMonth() + 1,
                    1
                  );
                  const lastNextMonth = new Date(
                    base.getFullYear(),
                    base.getMonth() + 2,
                    0
                  );
                  const nf = toYmdLocal(firstNextMonth);
                  const nt = toYmdLocal(lastNextMonth);
                  setRangeAndMaybeLoad(nf, nt);
                }}
              >
                다음달
              </button>

              <div className="ml-auto flex items-center gap-2">
                {isDirty && (
                  <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
                    변경됨 · 조회 필요
                  </span>
                )}
                <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={autoLoad}
                    onChange={(e) => setAutoLoad(e.target.checked)}
                    disabled={loading}
                  />
                  자동 조회
                </label>
                <button
                  type="button"
                  className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  disabled={loading}
                  onClick={resetFilters}
                >
                  초기화
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
              <label className="text-xs text-gray-800 dark:text-gray-200 sm:col-span-3">
                <span className="block mb-1">시작일</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  disabled={loading}
                />
              </label>

              <label className="text-xs text-gray-800 dark:text-gray-200 sm:col-span-3">
                <span className="block mb-1">종료일</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  disabled={loading}
                />
              </label>

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || !ready || !user || invalidRange}
                className="h-10 rounded border border-gray-400 px-3 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800 sm:col-span-6"
              >
                {loading ? '조회 중…' : '조회'}
              </button>
            </div>
            {invalidRange && (
              <div className="mt-2 text-[11px] text-red-600">
                * 시작일은 종료일보다 이후일 수 없습니다.
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={onlyMissingCheckout}
                  onChange={(e) => setOnlyMissingCheckout(e.target.checked)}
                  disabled={loading}
                />
                퇴근 누락만
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={onlyCorrected}
                  onChange={(e) => setOnlyCorrected(e.target.checked)}
                  disabled={loading}
                />
                정정 포함만
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={applySummaryFilter}
                  onChange={(e) => setApplySummaryFilter(e.target.checked)}
                  disabled={loading || !data}
                />
                집계에도 필터 적용
              </label>
            </div>
            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-300">
              * 평균 근무 시간은 제공하지 않습니다(요구사항 제외).
            </div>
          </section>
        )}

        {!forbidden && isEmployee && (
          <section className="rounded border border-gray-300 bg-white p-4 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
            {!data ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                조회 조건을 선택한 뒤 조회해 주세요.
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    결과
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadCsv('displayed')}
                      disabled={
                        loading ||
                        !data ||
                        displayedItems.length === 0 ||
                        invalidRange
                      }
                      className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                    >
                      CSV 다운로드(표시 {displayedItems.length}건)
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadCsv('all')}
                      disabled={
                        loading ||
                        !data ||
                        (data?.items?.length ?? 0) === 0 ||
                        invalidRange
                      }
                      className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                    >
                      CSV 다운로드(전체 {data?.items?.length ?? 0}건)
                    </button>

                    <div className="text-[11px] text-gray-500 dark:text-gray-300">
                      * 표시 항목은 현재 필터가 적용된 결과입니다.
                    </div>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      기간
                    </div>
                    <div className="text-sm font-semibold">
                      {data.from} ~ {data.to}
                    </div>
                  </div>
                  <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      근무일
                    </div>
                    <div className="text-sm font-semibold">
                      {data.totalDays}일
                    </div>
                  </div>
                  <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      총 근무시간
                    </div>
                    <div className="text-sm font-semibold">
                      {formatMinutes(summary.totalWorkMinutes)}
                    </div>
                  </div>
                  <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      정정
                    </div>
                    <div className="text-sm font-semibold">
                      {summary.correctedCount}건 ({summary.correctedRatePct}%)
                    </div>
                  </div>
                  <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      퇴근 누락
                    </div>
                    <div className="text-sm font-semibold">
                      {summary.missingCheckoutCount}건 (
                      {summary.missingCheckoutRatePct}%)
                    </div>
                  </div>
                  <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
                    <div className="text-[11px] text-gray-600 dark:text-gray-300">
                      유효 근무일
                    </div>
                    <div className="text-sm font-semibold">
                      {summary.validWorkDays}일
                    </div>
                  </div>
                </div>
                {(onlyMissingCheckout || onlyCorrected) && (
                  <div className="mb-2 text-[11px] text-gray-600 dark:text-gray-300">
                    표시: {displayedItems.length}건
                    {onlyMissingCheckout ? ' · 퇴근 누락만' : ''}
                    {onlyCorrected ? ' · 정정 포함만' : ''}
                  </div>
                )}

                {displayedItems.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    선택한 기간/필터 조건에 해당하는 항목이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="sticky top-0 z-10 border-b border-gray-400 bg-gray-200 text-left dark:border-gray-600 dark:bg-gray-950">
                          <th className="p-2">일자</th>
                          <th className="p-2">출근</th>
                          <th className="p-2">퇴근</th>
                          <th className="p-2">근무</th>
                          <th className="p-2">정정</th>
                          <th className="p-2">정정 요청</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedItems.map((x) => (
                          <tr
                            key={x.attendanceId}
                            className="border-b border-gray-300 dark:border-gray-600"
                          >
                            <td className="p-2 font-medium">{x.workDate}</td>
                            <td className="p-2">
                              {formatIsoToHm(x.checkInAt)}
                            </td>
                            <td className="p-2">
                              {formatIsoToHm(x.checkOutAt)}
                            </td>
                            <td className="p-2">
                              {x.workMinutes == null
                                ? '-'
                                : formatMinutes(x.workMinutes)}
                            </td>
                            <td className="p-2">{x.isCorrected ? 'Y' : '-'}</td>
                            <td className="p-2">
                              <button
                                type="button"
                                className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                                onClick={() =>
                                  setSelectedAttendance({
                                    attendanceId: x.attendanceId,
                                    workDate: x.workDate,
                                    checkInAt: x.checkInAt,
                                    checkOutAt: x.checkOutAt,
                                  })
                                }
                                disabled={loading}
                              >
                                정정 요청
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ✅ EMPLOYEE 본인 리포트에서의 정정 신청. ADMIN/MANAGER 대리 신청은 아래 ReportTab에서 처리 */}
        {!forbidden && isEmployee && user && selectedAttendance && (
          <CorrectionRequestModal
            open={!!selectedAttendance}
            onClose={() => setSelectedAttendance(null)}
            baseUrl={baseUrl}
            attendanceId={selectedAttendance.attendanceId}
            workDate={selectedAttendance.workDate}
            initialCheckInAt={selectedAttendance.checkInAt}
            initialCheckOutAt={selectedAttendance.checkOutAt}
            onCreated={() => {
              setToast('정정 요청이 접수되었습니다.');
              setSelectedAttendance(null);
              void load();
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function AttendanceReportPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900" />}
    >
      <AttendanceReportPageInner />
    </Suspense>
  );
}
