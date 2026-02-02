'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import CorrectionRequestDetailModal, {
  type CorrectionRequestListItem,
} from '@/app/_components/CorrectionRequestDetailModal';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type CorrectionRequestListResponse = {
  items: CorrectionRequestListItem[];
  page: number;
  size: number;
  totalElements: number;
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function CorrectionsPage() {
  const { user } = useAuth();

  const baseUrl = useMemo(() => {
    // 기존 정책 유지(최소 diff): env 없으면 localhost fallback
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const [items, setItems] = useState<CorrectionRequestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<CorrectionRequestListItem | null>(
    null
  );

  const fetchList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // 계약: GET /api/correction-requests?scope=requested_by_me
      const data = await apiFetch<CorrectionRequestListResponse>(
        `${baseUrl}/api/correction-requests?scope=requested_by_me&page=0&size=50`,
        { headers: { 'X-USER-ID': String(user.userId) } }
      );
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user, baseUrl]);

  useEffect(() => {
    if (!user) return;
    fetchList();
  }, [user, fetchList]);

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정 요청함</h1>
          <button
            type="button"
            onClick={fetchList}
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? '갱신 중...' : '새로고침'}
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-gray-600" aria-busy="true">
            목록 불러오는 중...
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
                  <Link
                    href={`/corrections/${it.requestId}`}
                    className="block w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          근태 #{it.attendanceId}
                        </span>
                        <span className="text-gray-600">상태 {it.status}</span>
                      </div>
                      <span className="text-xs text-gray-500">상세 보기</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {selected && user && (
        <CorrectionRequestDetailModal
          baseUrl={baseUrl}
          userId={user.userId}
          item={selected}
          onClose={() => setSelected(null)}
          onCanceled={fetchList}
        />
      )}
    </div>
  );
}
