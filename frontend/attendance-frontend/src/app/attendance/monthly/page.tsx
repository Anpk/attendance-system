'use client';

import { useAuth } from '../../context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import Link from 'next/link';

type AttendanceListItem = {
  attendanceId: number;
  workDate: string; // YYYY-MM-DD
  checkInAt: string | null;
  checkOutAt: string | null;
  isCorrected: boolean;
  // 백엔드 합성 필드: 해당 근태에 "내 PENDING 정정 요청" 존재 여부
  hasPendingCorrection?: boolean;
};

type AttendanceListResponse = {
  items: AttendanceListItem[];
  page: number;
  size: number;
  totalElements: number;
};

export default function AttendanceMonthPage() {
  const { user } = useAuth();

  const baseUrl = useMemo(() => {
    // 기존 페이지와 동일 정책 유지(최소 diff)
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const initialMonth = useMemo(() => {
    // 로컬 기준 YYYY-MM
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }, []);

  const [month, setMonth] = useState<string>(initialMonth);
  const [items, setItems] = useState<AttendanceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string>('');

  function formatHm(iso: string | null): string {
    if (!iso) return '-';
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const fetchMonth = useCallback(
    async (targetMonth: string) => {
      if (!user) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<AttendanceListResponse>(
          `${baseUrl}/api/attendance?month=${encodeURIComponent(targetMonth)}`
        );
        setItems(data.items ?? []);
      } catch (e) {
        setItems([]);
        setError(toUserMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [user, baseUrl]
  );

  // 최초 진입 + month 변경 시 재조회
  useEffect(() => {
    if (!user) return;
    fetchMonth(month);
  }, [user, month, baseUrl, fetchMonth]);

  // 성공 메시지 자동 해제(모바일 UX)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">월별 근태 목록</h1>
            <Link
              href="/corrections"
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              정정 요청함
            </Link>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>월</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
        </div>
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          ✅ 정정 신청 기능은{' '}
          <Link href="/attendance/report" className="underline">
            리포트
          </Link>{' '}
          페이지로 이동했습니다. 월별 페이지는 추후 폐지될 예정입니다.
        </div>

        {loading && (
          <p className="mt-4 text-sm text-gray-600" aria-busy="true">
            목록 불러오는 중...
          </p>
        )}

        {!loading && !error && toast && (
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            ✅ {toast}
          </p>
        )}

        {!loading && error && (
          <p className="mt-4 text-sm text-red-600">❌ {error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="mt-4 text-sm text-gray-600">표시할 근태가 없습니다.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <section className="mt-4 rounded border">
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.attendanceId}>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{it.workDate}</span>
                      <span className="text-gray-600">
                        출근 {formatHm(it.checkInAt)} · 퇴근{' '}
                        {formatHm(it.checkOutAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        {it.hasPendingCorrection ? (
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                            정정 대기
                          </span>
                        ) : null}

                        {it.isCorrected ? (
                          <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                            정정 반영
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                            원본
                          </span>
                        )}
                      </div>
                      <Link
                        href="/attendance/report"
                        className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-black"
                        aria-label="리포트에서 정정 요청"
                      >
                        리포트에서 정정
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
