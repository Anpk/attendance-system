'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
  const [openEmployeeIds, setOpenEmployeeIds] = useState<number[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<{
    attendanceId: number;
    workDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null>(null);
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const reportInvalidRange = useMemo(() => {
    if (!reportFrom || !reportTo) return false;
    return reportFrom > reportTo;
  }, [reportFrom, reportTo]);

  const userOptions = useMemo(() => {
    if (!reportData) return [];
    return reportData.employees
      .map((e) => ({
        userId: e.userId,
        label: `#${e.userId} · ${e.username}`,
      }))
      .sort((a, b) => a.userId - b.userId);
  }, [reportData]);

  const filteredEmployees = useMemo(() => {
    if (!reportData) return [];
    const uid = Number(reportUserId);
    if (!reportUserId || !Number.isFinite(uid)) return reportData.employees;
    return reportData.employees.filter((e) => e.userId === uid);
  }, [reportData, reportUserId]);

  useEffect(() => {
    if (!reportUserId) return;
    if (!reportData) return;
    const uid = Number(reportUserId);
    if (!Number.isFinite(uid)) return;
    if (!reportData.employees.some((e) => e.userId === uid)) {
      setReportUserId('');
    }
  }, [reportUserId, reportData]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (sites.length === 0) return;
    if (reportSiteId) return;
    setReportSiteId(String(sites[0].siteId));
  }, [ready, user, forbidden, sites, reportSiteId]);

  async function submitFetchReport() {
    if (!user) return;

    const sid = Number(reportSiteId);
    if (!Number.isFinite(sid)) {
      setFlashMessage('site를 선택해 주세요.');
      return;
    }
    if (!reportFrom || !reportTo) {
      setFlashMessage('from/to를 입력해 주세요.');
      return;
    }
    if (reportFrom > reportTo) {
      setFlashMessage('from은 to보다 이후일 수 없습니다.');
      return;
    }

    setReportLoading(true);
    try {
      const res = await adminFetchAttendanceReport({
        siteId: sid,
        from: reportFrom,
        to: reportTo,
      });
      setReportData(res);
      setOpenEmployeeIds([]);
      setReportUserId('');
    } catch (e) {
      setReportData(null);
      setFlashMessage(toUserMessage(e));
    } finally {
      setReportLoading(false);
    }
  }

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
    <section className="rounded border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Site 근태 리포트</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void submitFetchReport()}
            disabled={reportLoading || reportInvalidRange}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {reportLoading ? '조회 중…' : '조회'}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!reportData || reportLoading}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <label className="text-xs text-gray-700">
          from
          <input
            type="date"
            value={reportFrom}
            onChange={(e) => {
              setReportFrom(e.target.value);
              setReportData(null);
            }}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            disabled={reportLoading}
          />
        </label>

        <label className="text-xs text-gray-700">
          to
          <input
            type="date"
            value={reportTo}
            onChange={(e) => {
              setReportTo(e.target.value);
              setReportData(null);
            }}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            disabled={reportLoading}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
        <label className="text-xs text-gray-700">
          site
          <select
            value={reportSiteId}
            onChange={(e) => {
              setReportSiteId(e.target.value);
              setReportUserId('');
              setReportData(null);
              setOpenEmployeeIds([]);
            }}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
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

        <label className="text-xs text-gray-700">
          user
          <select
            value={reportUserId}
            onChange={(e) => setReportUserId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
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
          * from은 to보다 이후일 수 없습니다.
        </div>
      )}

      {!reportData ? (
        <div className="mt-4 text-sm text-gray-600">조회 결과가 없습니다.</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-600">기간</div>
              <div className="text-sm font-semibold">
                {reportData.from} ~ {reportData.to}
              </div>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-600">직원 수</div>
              <div className="text-sm font-semibold">
                {filteredEmployees.length}명
              </div>
              {reportUserId ? (
                <div className="mt-1 text-[11px] text-gray-600">
                  * 선택 직원만 표시 중
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-gray-600">
                  * 전체 {reportData.totalEmployees}명
                </div>
              )}
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-600">총 근무시간</div>
              <div className="text-sm font-semibold">
                {formatMinutes(
                  filteredEmployees.reduce(
                    (acc, e) => acc + (e.totalWorkMinutes ?? 0),
                    0
                  )
                )}
              </div>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-600">퇴근 누락</div>
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
            <div className="mt-4 text-sm text-gray-600">직원이 없습니다.</div>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-2">직원</th>
                    <th className="p-2">role</th>
                    <th className="p-2">active</th>
                    <th className="p-2">근무일</th>
                    <th className="p-2">총 근무</th>
                    <th className="p-2">누락</th>
                    <th className="p-2">정정</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(
                    (e: AdminAttendanceReportEmployeeResponse) => {
                      const isOpen = openEmployeeIds.includes(e.userId);
                      return (
                        <Fragment key={e.userId}>
                          <tr className="border-b">
                            <td className="p-2 font-medium">
                              #{e.userId} · {e.username}
                            </td>
                            <td className="p-2">{e.role}</td>
                            <td className="p-2">{e.active ? 'Y' : 'N'}</td>
                            <td className="p-2">{e.totalDays}일</td>
                            <td className="p-2">
                              {formatMinutes(e.totalWorkMinutes)}
                            </td>
                            <td className="p-2">{e.missingCheckoutCount}</td>
                            <td className="p-2">{e.correctedCount}</td>
                            <td className="p-2">
                              <button
                                type="button"
                                className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                                onClick={() => {
                                  setOpenEmployeeIds((prev) =>
                                    prev.includes(e.userId)
                                      ? prev.filter((x) => x !== e.userId)
                                      : [...prev, e.userId]
                                  );
                                }}
                              >
                                {isOpen ? '접기' : '상세'}
                              </button>
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="border-b bg-gray-50/50">
                              <td className="p-2" colSpan={8}>
                                {e.items.length === 0 ? (
                                  <div className="text-xs text-gray-600">
                                    항목이 없습니다.
                                  </div>
                                ) : (
                                  <div className="overflow-auto">
                                    <table className="w-full border-collapse text-xs">
                                      <thead>
                                        <tr className="border-b bg-white text-left">
                                          <th className="p-2">일자</th>
                                          <th className="p-2">출근</th>
                                          <th className="p-2">퇴근</th>
                                          <th className="p-2">근무</th>
                                          <th className="p-2">정정</th>
                                          <th className="p-2">정정 요청</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {e.items.map((it) => (
                                          <tr key={it.attendanceId} className="border-b">
                                            <td className="p-2 font-medium">
                                              {it.workDate}
                                            </td>
                                            <td className="p-2">
                                              {formatIsoToHm(it.checkInAt)}
                                            </td>
                                            <td className="p-2">
                                              {formatIsoToHm(it.checkOutAt)}
                                            </td>
                                            <td className="p-2">
                                              {it.workMinutes == null
                                                ? '-'
                                                : formatMinutes(it.workMinutes)}
                                            </td>
                                            <td className="p-2">
                                              {it.isCorrected ? 'Y' : '-'}
                                            </td>
                                            <td className="p-2">
                                              <button
                                                type="button"
                                                className="rounded border px-2 py-1 text-[11px] hover:bg-gray-50"
                                                onClick={() =>
                                                  setSelectedAttendance({
                                                    attendanceId: it.attendanceId,
                                                    workDate: it.workDate,
                                                    checkInAt: it.checkInAt,
                                                    checkOutAt: it.checkOutAt,
                                                  })
                                                }
                                                disabled={reportLoading}
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
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          ✅ {toast}
        </div>
      )}

      {user && selectedAttendance && (
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
            void submitFetchReport();
          }}
        />
      )}
    </section>
  );
}
