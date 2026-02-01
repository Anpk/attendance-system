'use client';

import { useAuth } from '../../context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import CorrectionRequestModal from '@/app/_components/CorrectionRequestModal';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type AttendanceListItem = {
  attendanceId: number;
  workDate: string; // YYYY-MM-DD
  checkInAt: string | null;
  checkOutAt: string | null;
  isCorrected: boolean;
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
  const [selected, setSelected] = useState<AttendanceListItem | null>(null);
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
          `${baseUrl}/api/attendance?month=${encodeURIComponent(targetMonth)}`,
          { headers: { 'X-USER-ID': String(user.userId) } }
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
            <a
              href="/corrections"
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              정정 요청함
            </a>
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
                      {it.isCorrected ? (
                        <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                          정정 반영
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                          원본
                        </span>
                      )}
                      <button
                        type="button"
                        className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-black disabled:opacity-50"
                        onClick={() => setSelected(it)}
                        disabled={loading}
                        aria-label={`${it.workDate} 근태 정정 요청`}
                      >
                        정정 요청
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {user && selected && (
        <CorrectionRequestModal
          open={!!selected}
          onClose={() => setSelected(null)}
          baseUrl={baseUrl}
          userId={user.userId}
          attendanceId={selected.attendanceId}
          workDate={selected.workDate}
          initialCheckInAt={selected.checkInAt}
          initialCheckOutAt={selected.checkOutAt}
          // 생성 성공 시 현재 month 기준으로 재조회
          onCreated={() => {
            setToast('정정 요청이 접수되었습니다.');
            fetchMonth(month);
          }}
        />
      )}
    </div>
  );
}
