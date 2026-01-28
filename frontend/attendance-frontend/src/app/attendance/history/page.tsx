'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AttendanceListResponse } from '@/lib/api/types';

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AttendanceListResponse>({
    items: [],
    page: 1,
    size: 20,
    totalElements: 0,
  });

  // 이번 달 기본값 (로컬 기준)
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }, []);

  const [month, setMonth] = useState(defaultMonth);

  // 환경변수 기반 API Base URL (런타임 하드코딩 제거 원칙)
  const baseUrl = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  async function fetchMonthList(targetMonth: string) {
    if (!user || loading) return;
    if (!baseUrl) {
      setMessage('❌ NEXT_PUBLIC_API_BASE_URL 환경변수가 설정되지 않았습니다.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<AttendanceListResponse>(
        `${baseUrl}/api/attendance?month=${encodeURIComponent(targetMonth)}&page=1&size=20`,
        {
          headers: { 'X-USER-ID': String(user.userId) },
        }
      );
      setData(res);
    } catch (e) {
      setMessage(`❌ ${toUserMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchMonthList(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month, baseUrl]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">근태 이력</h1>
        <button
          className="rounded border px-3 py-2"
          onClick={() => router.push('/attendance')}
        >
          돌아가기
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">월 선택</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border px-3 py-2"
          disabled={loading}
          aria-busy={loading}
        />
        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          onClick={() => fetchMonthList(month)}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? '처리 중...' : '조회'}
        </button>
      </div>

      {message && <p>{message}</p>}

      <section className="rounded border p-4">
        <div className="mb-3 text-sm text-gray-600">
          총 {data.totalElements}건
        </div>

        <ul className="flex flex-col gap-2">
          {data.items.map((it) => (
            <li key={it.attendanceId} className="rounded border p-3">
              <div className="font-medium">{it.workDate}</div>
              <div className="text-sm text-gray-700">
                출근: {it.checkInAt ?? '-'} / 퇴근: {it.checkOutAt ?? '-'}
              </div>
              {it.isCorrected && (
                <div className="mt-1 text-sm text-orange-600">정정 반영됨</div>
              )}
            </li>
          ))}
          {data.items.length === 0 && (
            <li className="text-sm text-gray-600">조회 결과가 없습니다.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
