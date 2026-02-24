'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function ReportTab({
  user,
  ready,
  forbidden,
  sites,
  setFlashMessage,
}: Props) {
  const reportDefaults = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYmdLocal(from), to: toYmdLocal(now) };
  }, []);

  const [reportSiteId, setReportSiteId] = useState<string>('');
  const [reportFrom, setReportFrom] = useState<string>(reportDefaults.from);
  const [reportTo, setReportTo] = useState<string>(reportDefaults.to);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] =
    useState<AdminAttendanceReportResponse | null>(null);
  const [openEmployeeIds, setOpenEmployeeIds] = useState<number[]>([]);

  const reportInvalidRange = useMemo(() => {
    if (!reportFrom || !reportTo) return false;
    return reportFrom > reportTo;
  }, [reportFrom, reportTo]);

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

  return (
    <section className="rounded border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Site 근태 리포트</h2>
        <button
          type="button"
          onClick={() => void submitFetchReport()}
          disabled={reportLoading || reportInvalidRange}
          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          {reportLoading ? '조회 중…' : '조회'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <label className="text-xs text-gray-700">
          site
          <select
            value={reportSiteId}
            onChange={(e) => {
              setReportSiteId(e.target.value);
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
                {reportData.totalEmployees}명
              </div>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-600">총 근무시간</div>
              <div className="text-sm font-semibold">
                {formatMinutes(
                  reportData.employees.reduce(
                    (acc, e) => acc + (e.totalWorkMinutes ?? 0),
                    0
                  )
                )}
              </div>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-[11px] text-gray-600">퇴근 누락</div>
              <div className="text-sm font-semibold">
                {reportData.employees.reduce(
                  (acc, e) => acc + (e.missingCheckoutCount ?? 0),
                  0
                )}
                건
              </div>
            </div>
          </div>

          {reportData.employees.length === 0 ? (
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
                  {reportData.employees.map(
                    (e: AdminAttendanceReportEmployeeResponse) => {
                      const isOpen = openEmployeeIds.includes(e.userId);
                      return (
                        <>
                          <tr key={e.userId} className="border-b">
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
                        </>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
