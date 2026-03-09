'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CorrectionRequestModal from '@/app/_components/CorrectionRequestModal';
import { toUserMessage } from '@/lib/api/error-messages';
import { adminFetchAttendanceReport } from '@/lib/api/admin';
import type {
  AdminSiteResponse,
  AdminAttendanceReportResponse,
  AdminAttendanceReportEmployeeResponse,
  EmployeeRole,
} from '@/lib/api/types';

type AuthUserLite = {
  userId: number;
  role: EmployeeRole;
} | null;

type Props = {
  user: AuthUserLite;
  ready: boolean;
  forbidden: boolean;
  sites: AdminSiteResponse[];
  setFlashMessage: (msg: string) => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function formatIsoToHm(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

export default function ReportTab({
  user,
  ready,
  forbidden,
  sites,
  setFlashMessage,
}: Props) {
  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const reportDefaults = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYmdLocal(from), to: toYmdLocal(now) };
  }, []);

  const [reportSiteId, setReportSiteId] = useState<string>('');
  const [reportUserId, setReportUserId] = useState<string>(''); // '' = 전체
  const [reportFrom, setReportFrom] = useState<string>(reportDefaults.from);
  const [reportTo, setReportTo] = useState<string>(reportDefaults.to);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] =
    useState<AdminAttendanceReportResponse | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [autoLoad, setAutoLoad] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{
    userId: number;
    username: string;
    items: AdminAttendanceReportEmployeeResponse['items'];
  } | null>(null);
  function isReportTargetEmployee(
    e: AdminAttendanceReportEmployeeResponse
  ): boolean {
    // 집계/표/CSV 대상은 EMPLOYEE만
    return e.role === 'EMPLOYEE';
  }
  const [selectedAttendance, setSelectedAttendance] = useState<{
    attendanceId: number;
    workDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null>(null);
  const [toast, setToast] = useState<string>('');
  const reportSeqRef = useRef(0);
  const lastLoadedRef = useRef<{
    siteId: string;
    from: string;
    to: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const reportInvalidRange = useMemo(() => {
    if (!reportFrom || !reportTo) return false;
    return reportFrom > reportTo;
  }, [reportFrom, reportTo]);

  const quickPreset = useMemo(() => {
    if (!reportFrom || !reportTo)
      return null as
        | 'today'
        | 'week'
        | 'thisMonth'
        | 'prevMonth'
        | 'nextMonth'
        | null;

    const now = new Date();
    const today = toYmdLocal(now);
    if (reportFrom === today && reportTo === today) return 'today';

    const day = now.getDay();
    const diffToMon = (day + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    if (reportFrom === toYmdLocal(mon) && reportTo === toYmdLocal(sun))
      return 'week';

    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastThis = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (
      reportFrom === toYmdLocal(firstThis) &&
      reportTo === toYmdLocal(lastThis)
    )
      return 'thisMonth';

    // prev/next 기준은 현재 선택된 reportFrom
    const base = new Date(reportFrom + 'T00:00:00');
    const firstBase = new Date(base.getFullYear(), base.getMonth(), 1);

    const lastPrev = new Date(firstBase);
    lastPrev.setDate(0);
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    if (
      reportFrom === toYmdLocal(firstPrev) &&
      reportTo === toYmdLocal(lastPrev)
    )
      return 'prevMonth';

    const firstNext = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const lastNext = new Date(base.getFullYear(), base.getMonth() + 2, 0);
    if (
      reportFrom === toYmdLocal(firstNext) &&
      reportTo === toYmdLocal(lastNext)
    )
      return 'nextMonth';

    return null;
  }, [reportFrom, reportTo]);

  const isDirty = useMemo(() => {
    if (autoLoad) return false;
    const last = lastLoadedRef.current;
    if (!last) return false;
    return (
      last.siteId !== reportSiteId ||
      last.from !== reportFrom ||
      last.to !== reportTo
    );
  }, [autoLoad, reportSiteId, reportFrom, reportTo]);

  const userOptions = useMemo(() => {
    if (!reportData) return [];
    return reportData.employees
      .filter(isReportTargetEmployee)
      .filter((e) => (activeOnly ? e.active : true))
      .map((e) => ({
        userId: e.userId,
        label: `#${e.userId} · ${e.username}`,
      }))
      .sort((a, b) => a.userId - b.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, activeOnly]);

  const filteredEmployees = useMemo(() => {
    if (!reportData) return [];

    let list = reportData.employees.filter(isReportTargetEmployee);
    if (activeOnly) list = list.filter((e) => e.active);

    const uid = Number(reportUserId);
    if (!reportUserId || !Number.isFinite(uid)) return list;
    return list.filter((e) => e.userId === uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, reportUserId, activeOnly]);

  useEffect(() => {
    if (!reportUserId) return;
    const uid = Number(reportUserId);
    if (!Number.isFinite(uid)) return;
    if (!userOptions.some((u) => u.userId === uid)) {
      setReportUserId('');
    }
  }, [reportUserId, userOptions]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (sites.length === 0) return;
    if (reportSiteId) return;
    setReportSiteId(String(sites[0].siteId));
  }, [ready, user, forbidden, sites, reportSiteId]);

  async function submitFetchReport(override?: { from: string; to: string }) {
    if (!user) return;

    const sid = Number(reportSiteId);
    if (!Number.isFinite(sid)) {
      setFlashMessage('근무지를 선택해 주세요.');
      return;
    }
    const effectiveFrom = override?.from ?? reportFrom;
    const effectiveTo = override?.to ?? reportTo;
    if (!effectiveFrom || !effectiveTo) {
      setFlashMessage('시작일/종료일을 입력해 주세요.');
      return;
    }
    if (effectiveFrom > effectiveTo) {
      setFlashMessage('시작일은 종료일보다 이후일 수 없습니다.');
      return;
    }

    const mySeq = ++reportSeqRef.current;
    setReportLoading(true);
    try {
      const res = await adminFetchAttendanceReport({
        siteId: sid,
        from: effectiveFrom,
        to: effectiveTo,
      });
      if (mySeq !== reportSeqRef.current) return;
      setReportData(res);
      lastLoadedRef.current = {
        siteId: String(sid),
        from: effectiveFrom,
        to: effectiveTo,
      };
      setReportUserId('');
    } catch (e) {
      if (mySeq !== reportSeqRef.current) return;
      setReportData(null);
      setFlashMessage(toUserMessage(e));
    } finally {
      if (mySeq === reportSeqRef.current) setReportLoading(false);
    }
  }
  // 자동 조회: 근무지/기간 변경 시 디바운스 후 조회(직원 선택은 로컬 필터)
  useEffect(() => {
    if (!autoLoad) return;
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (!reportSiteId) return;
    if (!reportFrom || !reportTo) return;
    if (reportFrom > reportTo) return;

    const t = setTimeout(() => {
      void submitFetchReport();
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, reportSiteId, reportFrom, reportTo, ready, user, forbidden]);
  const setRange = useCallback((nf: string, nt: string) => {
    setReportFrom(nf);
    setReportTo(nt);
    setReportData(null);
  }, []);

  const resetFilters = useCallback(() => {
    setReportFrom(reportDefaults.from);
    setReportTo(reportDefaults.to);
    setReportUserId('');
    setActiveOnly(true);
    setReportData(null);
    // 초기화도 즉시 조회
    void submitFetchReport({
      from: reportDefaults.from,
      to: reportDefaults.to,
    });
  }, [reportDefaults]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (sites.length === 0) return;
    if (!reportSiteId) return;
    if (reportLoading) return;
    if (reportData) return;
    void submitFetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, forbidden, sites, reportSiteId]);

  function downloadCsv() {
    if (!reportData) {
      setFlashMessage('조회 후 다운로드할 수 있습니다.');
      return;
    }
    const employees = filteredEmployees;
    if (employees.length === 0) {
      setFlashMessage('다운로드할 직원 데이터가 없습니다.');
      return;
    }

    const header = [
      'siteId',
      'from',
      'to',
      'employeeUserId',
      'employeeUsername',
      'workDate',
      'checkIn',
      'checkOut',
      'workMinutes',
      'isCorrected',
    ];

    const rows: string[] = [];
    for (const e of employees) {
      for (const it of e.items) {
        const checkIn = it.checkInAt ? formatIsoToHm(it.checkInAt) : '';
        const checkOut = it.checkOutAt ? formatIsoToHm(it.checkOutAt) : '';
        const mins = it.workMinutes == null ? '' : String(it.workMinutes);
        const corrected = it.isCorrected ? 'Y' : 'N';
        rows.push(
          [
            String(reportData.siteId),
            reportData.from,
            reportData.to,
            String(e.userId),
            e.username,
            it.workDate,
            checkIn,
            checkOut,
            mins,
            corrected,
          ]
            .map((x) => csvEscape(String(x)))
            .join(',')
        );
      }
    }

    const bom = '\uFEFF';
    const csv = bom + header.join(',') + '\n' + rows.join('\n') + '\n';

    const safeSiteId = String(reportData.siteId).replace(/[^0-9]/g, '');
    const safeFrom = reportData.from.replace(/[^0-9-]/g, '');
    const safeTo = reportData.to.replace(/[^0-9-]/g, '');
    const uid = reportUserId ? reportUserId.replace(/[^0-9]/g, '') : 'all';
    const filename = `admin-attendance-report_site-${safeSiteId}_user-${uid}_${safeFrom}_to_${safeTo}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    setFlashMessage('CSV 다운로드를 시작했습니다.');
  }

  return (
    <section className="rounded border border-gray-300 bg-white p-4 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">근무지 근태 리포트</h2>
        {reportLoading && (
          <span className="ml-2 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-200">
            조회 중…
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
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
              disabled={reportLoading}
            />
            자동 조회
          </label>

          <button
            type="button"
            onClick={resetFilters}
            disabled={reportLoading}
            className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            초기화
          </button>

          <button
            type="button"
            onClick={() => void submitFetchReport()}
            disabled={reportLoading || reportInvalidRange}
            className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {reportLoading ? '조회 중…' : '조회'}
          </button>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={!reportData || reportLoading}
            className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            CSV 다운로드
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
          빠른 선택
        </div>

        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
            quickPreset === 'today'
              ? 'border-gray-700 bg-gray-200 text-gray-900 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100'
              : 'border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
          }`}
          disabled={reportLoading}
          onClick={() => {
            const now = new Date();
            const nf = toYmdLocal(now);
            const nt = toYmdLocal(now);
            setRange(nf, nt);
            void submitFetchReport({ from: nf, to: nt });
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
          disabled={reportLoading}
          onClick={() => {
            const now = new Date();
            const day = now.getDay();
            const diffToMon = (day + 6) % 7;
            const mon = new Date(now);
            mon.setDate(now.getDate() - diffToMon);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            const nf = toYmdLocal(mon);
            const nt = toYmdLocal(sun);
            setRange(nf, nt);
            void submitFetchReport({ from: nf, to: nt });
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
          disabled={reportLoading}
          onClick={() => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const nf = toYmdLocal(first);
            const nt = toYmdLocal(last);
            setRange(nf, nt);
            void submitFetchReport({ from: nf, to: nt });
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
          disabled={reportLoading}
          onClick={() => {
            const base = reportFrom
              ? new Date(reportFrom + 'T00:00:00')
              : new Date();
            const firstThis = new Date(base.getFullYear(), base.getMonth(), 1);
            const lastPrev = new Date(firstThis);
            lastPrev.setDate(0);
            const firstPrev = new Date(
              lastPrev.getFullYear(),
              lastPrev.getMonth(),
              1
            );
            const nf = toYmdLocal(firstPrev);
            const nt = toYmdLocal(lastPrev);
            setRange(nf, nt);
            void submitFetchReport({ from: nf, to: nt });
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
          disabled={reportLoading}
          onClick={() => {
            const base = reportFrom
              ? new Date(reportFrom + 'T00:00:00')
              : new Date();
            const firstNext = new Date(
              base.getFullYear(),
              base.getMonth() + 1,
              1
            );
            const lastNext = new Date(
              base.getFullYear(),
              base.getMonth() + 2,
              0
            );
            const nf = toYmdLocal(firstNext);
            const nt = toYmdLocal(lastNext);
            setRange(nf, nt);
            void submitFetchReport({ from: nf, to: nt });
          }}
        >
          다음달
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <label className="text-xs text-gray-800 dark:text-gray-200">
          <span className="block mb-1">시작일</span>
          <input
            type="date"
            value={reportFrom}
            onChange={(e) => {
              setReportFrom(e.target.value);
              setReportData(null);
            }}
            className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
            disabled={reportLoading}
          />
        </label>

        <label className="text-xs text-gray-800 dark:text-gray-200">
          <span className="block mb-1">종료일</span>
          <input
            type="date"
            value={reportTo}
            onChange={(e) => {
              setReportTo(e.target.value);
              setReportData(null);
            }}
            className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
            disabled={reportLoading}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <label className="text-xs text-gray-800 dark:text-gray-200">
          <span className="block mb-1">근무지</span>
          <select
            value={reportSiteId}
            onChange={(e) => {
              setReportSiteId(e.target.value);
              setReportUserId('');
              setReportData(null);
            }}
            className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
            disabled={reportLoading}
          >
            <option value="">선택…</option>
            {sites.map((s) => (
              <option key={s.siteId} value={String(s.siteId)}>
                #{s.siteId} · {s.name}
                {s.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-800 dark:text-gray-200">
          <div className="flex items-end justify-between gap-2">
            <span className="block mb-1">직원</span>
            <label className="flex items-center gap-2 text-[11px] text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                disabled={reportLoading}
              />
              활성 사용자만
            </label>
          </div>
          <select
            value={reportUserId}
            onChange={(e) => setReportUserId(e.target.value)}
            className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
            disabled={reportLoading || !reportData}
          >
            <option value="">전체</option>
            {userOptions.map((u) => (
              <option key={u.userId} value={String(u.userId)}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reportInvalidRange && (
        <div className="mt-2 text-[11px] text-red-600">
          * 시작일은 종료일보다 이후일 수 없습니다.
        </div>
      )}

      {!reportData ? (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          근무지/기간을 선택한 뒤 조회해 주세요.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                기간
              </div>
              <div className="text-sm font-semibold">
                {reportData.from} ~ {reportData.to}
              </div>
            </div>
            <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                직원 수
              </div>
              <div className="text-sm font-semibold">
                {filteredEmployees.length}명
              </div>
              {reportUserId ? (
                <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                  * 선택 직원만 표시 중
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
                  * 전체 {reportData.totalEmployees}명
                </div>
              )}
            </div>
            <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                총 근무시간
              </div>
              <div className="text-sm font-semibold">
                {formatMinutes(
                  filteredEmployees.reduce(
                    (acc, e) => acc + (e.totalWorkMinutes ?? 0),
                    0
                  )
                )}
              </div>
            </div>
            <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-950">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                퇴근 누락
              </div>
              <div className="text-sm font-semibold">
                {filteredEmployees.reduce(
                  (acc, e) => acc + (e.missingCheckoutCount ?? 0),
                  0
                )}
                건
              </div>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              선택한 조건에 해당하는 직원이 없습니다.
            </div>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-gray-300 bg-gray-100 text-left dark:border-gray-600 dark:bg-gray-950">
                    <th className="p-2">직원</th>
                    <th className="p-2">근무일</th>
                    <th className="p-2">총 근무</th>
                    <th className="p-2">누락</th>
                    <th className="p-2">정정</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(
                    (e: AdminAttendanceReportEmployeeResponse) => (
                      <tr
                        key={e.userId}
                        className="border-b border-gray-300 dark:border-gray-600"
                      >
                        <td className="p-2 font-medium">
                          #{e.userId} · {e.username}
                        </td>
                        <td className="p-2">{e.totalDays}일</td>
                        <td className="p-2">
                          {formatMinutes(e.totalWorkMinutes)}
                        </td>
                        <td className="p-2">{e.missingCheckoutCount}</td>
                        <td className="p-2">{e.correctedCount}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                            onClick={() => {
                              setSelectedEmployee({
                                userId: e.userId,
                                username: e.username,
                                items: e.items,
                              });
                            }}
                            disabled={reportLoading}
                          >
                            상세 보기
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <EmployeeDetailModal
                open={!!selectedEmployee}
                title={
                  selectedEmployee
                    ? `#${selectedEmployee.userId} · ${selectedEmployee.username} 상세`
                    : '상세'
                }
                items={selectedEmployee?.items ?? []}
                submitting={reportLoading}
                onClose={() => setSelectedEmployee(null)}
                onRequestCorrection={(it) => {
                  setSelectedAttendance(it);
                }}
              />
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/30 dark:text-green-200">
          ✅ {toast}
        </div>
      )}

      {user && selectedAttendance && (
        <CorrectionRequestModal
          open={!!selectedAttendance}
          onClose={() => {
            setSelectedAttendance(null);
          }}
          baseUrl={baseUrl}
          attendanceId={selectedAttendance.attendanceId}
          workDate={selectedAttendance.workDate}
          initialCheckInAt={selectedAttendance.checkInAt}
          initialCheckOutAt={selectedAttendance.checkOutAt}
          onCreated={() => {
            setToast('정정 요청이 접수되었습니다.');
            setSelectedAttendance(null);
            void submitFetchReport();
          }}
        />
      )}
    </section>
  );
}

function EmployeeDetailModal(props: {
  open: boolean;
  title: string;
  items: AdminAttendanceReportEmployeeResponse['items'];
  submitting: boolean;
  onClose: () => void;
  onRequestCorrection: (it: {
    attendanceId: number;
    workDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  }) => void;
}) {
  const { open, title, items, submitting, onClose, onRequestCorrection } =
    props;
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-busy={submitting}
      onMouseDown={(ev) => {
        if (submitting) return;
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-lg bg-white p-4 shadow text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              선택한 기간의 근태 상세 내역입니다.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            닫기
          </button>
        </div>

        <div className="mt-3 flex-1 overflow-hidden">
          {items.length === 0 ? (
            <div className="rounded border border-gray-300 bg-gray-100 p-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-200">
              선택한 기간에 해당하는 근태 항목이 없습니다.
            </div>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-gray-300 bg-gray-100 text-left dark:border-gray-600 dark:bg-gray-950">
                    <th className="p-2">일자</th>
                    <th className="p-2">출근</th>
                    <th className="p-2">퇴근</th>
                    <th className="p-2">근무</th>
                    <th className="p-2">정정</th>
                    <th className="p-2">정정 요청</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.attendanceId}
                      className="border-b border-gray-300 dark:border-gray-600"
                    >
                      <td className="p-2 font-medium">{it.workDate}</td>
                      <td className="p-2">{formatIsoToHm(it.checkInAt)}</td>
                      <td className="p-2">{formatIsoToHm(it.checkOutAt)}</td>
                      <td className="p-2">
                        {it.workMinutes == null
                          ? '-'
                          : formatMinutes(it.workMinutes)}
                      </td>
                      <td className="p-2">{it.isCorrected ? 'Y' : '-'}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          onClick={() =>
                            onRequestCorrection({
                              attendanceId: it.attendanceId,
                              workDate: it.workDate,
                              checkInAt: it.checkInAt,
                              checkOutAt: it.checkOutAt,
                            })
                          }
                          disabled={submitting}
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
        </div>
      </div>
    </div>
  );
}
