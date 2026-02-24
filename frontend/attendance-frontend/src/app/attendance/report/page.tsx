'use client';

import AppHeader from '@/app/_components/AppHeader';
import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';
import { toUserMessage } from '@/lib/api/error-messages';
import { fetchAttendanceReport } from '@/lib/api/attendance-report';
import type { AttendanceReportResponse } from '@/lib/api/types';
import { useEffect, useMemo, useState } from 'react';

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

export default function AttendanceReportPage() {
  const { user, ready, forbidden } = useRequireAuth();
  const { message, setFlashMessage, clearMessage } = useFlashMessage();

  const defaults = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYmdLocal(from), to: toYmdLocal(now) };
  }, []);

  const [from, setFrom] = useState<string>(defaults.from);
  const [to, setTo] = useState<string>(defaults.to);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AttendanceReportResponse | null>(null);

  const [onlyMissingCheckout, setOnlyMissingCheckout] = useState(false);
  const [onlyCorrected, setOnlyCorrected] = useState(false);

  const displayedItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((x) => {
      if (onlyMissingCheckout && x.workMinutes != null) return false;
      if (onlyCorrected && !x.isCorrected) return false;
      return true;
    });
  }, [data, onlyMissingCheckout, onlyCorrected]);

  const summary = useMemo(() => {
    if (!data) {
      return {
        correctedCount: 0,
        correctedRatePct: 0,
        missingCheckoutCount: 0,
        missingCheckoutRatePct: 0,
        validWorkDays: 0,
      };
    }

    const totalDays = data.totalDays || data.items.length;
    const correctedCount = data.items.filter((x) => x.isCorrected).length;
    const missingCheckoutCount = data.items.filter(
      (x) => x.checkInAt != null && x.checkOutAt == null
    ).length;
    const validWorkDays = data.items.filter(
      (x) => x.workMinutes != null
    ).length;

    const correctedRatePct =
      totalDays > 0 ? Math.round((correctedCount / totalDays) * 100) : 0;
    const missingCheckoutRatePct =
      totalDays > 0 ? Math.round((missingCheckoutCount / totalDays) * 100) : 0;

    return {
      correctedCount,
      correctedRatePct,
      missingCheckoutCount,
      missingCheckoutRatePct,
      validWorkDays,
    };
  }, [data]);

  async function load(override?: { from: string; to: string }) {
    if (!ready) return;
    if (!user) return;

    const effectiveFrom = override?.from ?? from;
    const effectiveTo = override?.to ?? to;

    if (!effectiveFrom || !effectiveTo) {
      setFlashMessage('from/to를 입력해 주세요.');
      return;
    }

    setLoading(true);
    clearMessage();
    try {
      const res = await fetchAttendanceReport({
        from: effectiveFrom,
        to: effectiveTo,
      });
      setData(res);
    } catch (e) {
      setData(null);
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!data) {
      setFlashMessage('조회 후 다운로드할 수 있습니다.');
      return;
    }
    if (displayedItems.length === 0) {
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

    const rows = displayedItems.map((x) => {
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
    const filename = `attendance-report_user-${safeUserId}_${safeFrom}_to_${safeTo}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    setFlashMessage('CSV 다운로드를 시작했습니다.');
  }

  // 최초 진입 시 자동 로드
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">근태 리포트</h1>
          <div className="mt-1 text-xs text-gray-600">
            기간(from~to) 동안의 근무일/총 근무시간을 확인합니다.
          </div>
        </div>

        {ready && forbidden && (
          <div className="mb-4 rounded border bg-white p-4 text-sm">
            권한이 없습니다.
          </div>
        )}

        {message && (
          <div className="mb-4 rounded border bg-white px-3 py-2 text-sm">
            {message}
          </div>
        )}

        <section className="mb-4 rounded border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="text-xs text-gray-700">프리셋</div>

            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                const now = new Date();
                const f = new Date(now.getFullYear(), now.getMonth(), 1);
                const nf = toYmdLocal(f);
                const nt = toYmdLocal(now);
                setFrom(nf);
                setTo(nt);
                void load({ from: nf, to: nt });
              }}
            >
              이번 달
            </button>

            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                const now = new Date();
                const firstThisMonth = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  1
                );
                const lastPrevMonth = addDays(firstThisMonth, -1);
                const firstPrevMonth = new Date(
                  lastPrevMonth.getFullYear(),
                  lastPrevMonth.getMonth(),
                  1
                );
                const nf = toYmdLocal(firstPrevMonth);
                const nt = toYmdLocal(lastPrevMonth);
                setFrom(nf);
                setTo(nt);
                void load({ from: nf, to: nt });
              }}
            >
              지난 달
            </button>

            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                const now = new Date();
                const nf = toYmdLocal(addDays(now, -6));
                const nt = toYmdLocal(now);
                setFrom(nf);
                setTo(nt);
                void load({ from: nf, to: nt });
              }}
            >
              최근 7일
            </button>

            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                const now = new Date();
                const nf = toYmdLocal(addDays(now, -29));
                const nt = toYmdLocal(now);
                setFrom(nf);
                setTo(nt);
                void load({ from: nf, to: nt });
              }}
            >
              최근 30일
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <label className="text-xs text-gray-700">
              from
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                disabled={loading}
              />
            </label>

            <label className="text-xs text-gray-700">
              to
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                disabled={loading}
              />
            </label>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !ready || !user}
              className="h-10 rounded border px-3 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? '조회 중…' : '조회'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={onlyMissingCheckout}
                onChange={(e) => setOnlyMissingCheckout(e.target.checked)}
                disabled={loading}
              />
              퇴근 누락만
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={onlyCorrected}
                onChange={(e) => setOnlyCorrected(e.target.checked)}
                disabled={loading}
              />
              정정 포함만
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              disabled={loading || !data || displayedItems.length === 0}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              CSV 다운로드
            </button>
            <div className="text-[11px] text-gray-500">
              * 현재 표시 중인 항목(필터 적용)을 CSV로 다운로드합니다.
            </div>
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            * 평균 근무 시간은 제공하지 않습니다(요구사항 제외).
          </div>
        </section>

        <section className="rounded border bg-white p-4">
          {!data ? (
            <div className="text-sm text-gray-600">조회 결과가 없습니다.</div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-600">기간</div>
                  <div className="text-sm font-semibold">
                    {data.from} ~ {data.to}
                  </div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-600">근무일</div>
                  <div className="text-sm font-semibold">
                    {data.totalDays}일
                  </div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-600">총 근무시간</div>
                  <div className="text-sm font-semibold">
                    {formatMinutes(data.totalWorkMinutes)}
                  </div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-600">정정</div>
                  <div className="text-sm font-semibold">
                    {summary.correctedCount}건 ({summary.correctedRatePct}%)
                  </div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-600">퇴근 누락</div>
                  <div className="text-sm font-semibold">
                    {summary.missingCheckoutCount}건 (
                    {summary.missingCheckoutRatePct}%)
                  </div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-[11px] text-gray-600">유효 근무일</div>
                  <div className="text-sm font-semibold">
                    {summary.validWorkDays}일
                  </div>
                </div>
              </div>
              {(onlyMissingCheckout || onlyCorrected) && (
                <div className="mb-2 text-[11px] text-gray-600">
                  표시: {displayedItems.length}건
                  {onlyMissingCheckout ? ' · 퇴근 누락만' : ''}
                  {onlyCorrected ? ' · 정정 포함만' : ''}
                </div>
              )}

              {displayedItems.length === 0 ? (
                <div className="text-sm text-gray-600">항목이 없습니다.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-2">일자</th>
                        <th className="p-2">출근</th>
                        <th className="p-2">퇴근</th>
                        <th className="p-2">근무</th>
                        <th className="p-2">정정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedItems.map((x) => (
                        <tr key={x.attendanceId} className="border-b">
                          <td className="p-2 font-medium">{x.workDate}</td>
                          <td className="p-2">{formatIsoToHm(x.checkInAt)}</td>
                          <td className="p-2">{formatIsoToHm(x.checkOutAt)}</td>
                          <td className="p-2">
                            {x.workMinutes == null
                              ? '-'
                              : formatMinutes(x.workMinutes)}
                          </td>
                          <td className="p-2">{x.isCorrected ? 'Y' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
