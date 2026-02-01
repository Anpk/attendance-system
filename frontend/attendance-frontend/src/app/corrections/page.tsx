'use client';

import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
type CorrectionType = 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';

type CorrectionRequestItem = {
  requestId: number;
  attendanceId: number;
  status: CorrectionStatus;
  type: CorrectionType;
  requestedBy: number;
  requestedAt: string; // ISO
};

type CorrectionRequestListResponse = {
  items: CorrectionRequestItem[];
  page: number;
  size: number;
  totalElements: number;
};

function formatYmdHm(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(status: CorrectionStatus) {
  switch (status) {
    case 'PENDING':
      return '대기';
    case 'APPROVED':
      return '승인';
    case 'REJECTED':
      return '반려';
    case 'CANCELED':
      return '취소';
  }
}

export default function CorrectionsPage() {
  const { user } = useAuth();

  const baseUrl = useMemo(() => {
    // 기존 페이지와 동일 정책 유지(최소 diff)
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const [status, setStatus] = useState<string>(''); // '' => 전체
  const [items, setItems] = useState<CorrectionRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  async function fetchMine() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('scope', 'requested_by_me');
      if (status) qs.set('status', status);
      // 최소 구현: 페이징 UI 없이 넉넉히 가져오기
      qs.set('page', '0');
      qs.set('size', '50');

      const data = await apiFetch<CorrectionRequestListResponse>(
        `${baseUrl}/api/correction-requests?${qs.toString()}`,
        { headers: { 'X-USER-ID': String(user.userId) } }
      );
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, baseUrl]);

  // 성공 메시지 자동 해제(모바일 UX)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function cancelRequest(requestId: number) {
    if (!user) return;
    if (!confirm('정정 요청을 취소할까요?')) return;

    setLoading(true);
    setError('');
    try {
      await apiFetch(`${baseUrl}/api/correction-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'X-USER-ID': String(user.userId) },
      });
      setToast('정정 요청이 취소되었습니다.');
      await fetchMine();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">정정 요청함</h1>
            <a
              href="/attendance/monthly"
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              월별 목록으로
            </a>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>상태</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded border px-2 py-1"
              disabled={loading}
            >
              <option value="">전체</option>
              <option value="PENDING">대기</option>
              <option value="APPROVED">승인</option>
              <option value="REJECTED">반려</option>
              <option value="CANCELED">취소</option>
            </select>
          </label>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-gray-600" aria-busy="true">
            불러오는 중...
          </p>
        )}

        {!loading && toast && (
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            ✅ {toast}
          </p>
        )}

        {!loading && error && (
          <p className="mt-4 text-sm text-red-600">❌ {error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="mt-4 text-sm text-gray-600">
            표시할 정정 요청이 없습니다.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <section className="mt-4 rounded border">
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.requestId} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{it.requestId}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {statusBadge(it.status)}
                        </span>
                        <span className="text-xs text-gray-500">{it.type}</span>
                      </div>
                      <span className="text-gray-600">
                        요청일시 {formatYmdHm(it.requestedAt)} · attendanceId{' '}
                        {it.attendanceId}
                      </span>
                    </div>

                    {it.status === 'PENDING' ? (
                      <button
                        type="button"
                        className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-black disabled:opacity-50"
                        onClick={() => cancelRequest(it.requestId)}
                        disabled={loading}
                      >
                        취소
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
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
