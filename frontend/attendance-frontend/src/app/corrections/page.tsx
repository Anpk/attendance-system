'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import type { CorrectionRequestListItem } from '@/app/_components/CorrectionRequestDetailModal';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type CorrectionRequestListResponse = {
  items: CorrectionRequestListItem[];
  page: number;
  size: number;
  totalElements: number;
};

export default function CorrectionsPage() {
  const { user } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  // tab=my | approvable (기본 my)
  const tab = searchParams.get('tab') === 'approvable' ? 'approvable' : 'my';

  // ✅ 승인자만 승인 대기 탭 노출 (프론트 가드)
  // - role 기반만 사용 (최소/명확): MANAGER/ADMIN만 approvable 탭 접근 가능
  const isApprover = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const baseUrl = useMemo(() => {
    // 기존 정책 유지(최소 diff): env 없으면 localhost fallback
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const [items, setItems] = useState<CorrectionRequestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = useCallback(async () => {
    if (!user) return;

    // ✅ 직원이 approvable scope를 호출하지 않도록 차단
    // - URL이 approvable로 들어와도(직접 입력/즐겨찾기 등) API 호출 전에 my로 강제
    const effectiveTab: 'my' | 'approvable' = !isApprover ? 'my' : tab;
    if (tab === 'approvable' && !isApprover) {
      router.replace('/corrections?tab=my');
    }

    setLoading(true);
    setError('');
    try {
      // 계약: 탭에 따라 scope 변경
      // - 내 정정 요청: scope=requested_by_me
      // - 정정 승인 대기: scope=approvable&status=PENDING
      const url =
        effectiveTab === 'my'
          ? `${baseUrl}/api/correction-requests?scope=requested_by_me&page=0&size=50`
          : `${baseUrl}/api/correction-requests?scope=approvable&status=PENDING&page=0&size=50`;

      const data = await apiFetch<CorrectionRequestListResponse>(url, {
        headers: { 'X-USER-ID': String(user.userId) },
      });
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user, baseUrl, tab, isApprover, router]);

  useEffect(() => {
    if (!user) return;
    fetchList();
  }, [user, fetchList]);

  useEffect(() => {
    if (!user) return;

    // ✅ 비승인자가 URL로 approvable 탭에 직접 접근하면 my 탭으로 되돌림
    if (!isApprover && tab === 'approvable') {
      router.replace('/corrections?tab=my');
    }
  }, [user, isApprover, tab, router]);

  function switchTab(next: 'my' | 'approvable') {
    // URL로 탭 상태 유지(뒤로가기 UX 포함)
    const q = next === 'approvable' ? '?tab=approvable' : '?tab=my';
    router.replace(`/corrections${q}`);
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정</h1>
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

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => switchTab('my')}
            className={`rounded px-3 py-2 text-sm ${
              tab === 'my' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
            }`}
            disabled={loading}
          >
            내 정정 요청
          </button>
          {isApprover && (
            <button
              type="button"
              onClick={() => switchTab('approvable')}
              className={`rounded px-3 py-2 text-sm ${
                tab === 'approvable'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
              disabled={loading}
            >
              정정 승인 대기
            </button>
          )}
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
            {tab === 'my'
              ? '표시할 정정 요청이 없습니다.'
              : '승인 대기 요청이 없습니다.'}
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <section className="mt-4 rounded border">
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.requestId} className="px-4 py-3 text-sm">
                  <Link
                    href={
                      tab === 'approvable'
                        ? `/corrections/${it.requestId}?scope=approvable`
                        : `/corrections/${it.requestId}`
                    }
                    className="block w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          요청 #{it.requestId}
                        </span>
                        <span className="text-gray-600">
                          상태 {it.status}
                          {tab === 'approvable'
                            ? ` · 요청자 ${it.requestedBy}`
                            : ''}
                        </span>
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
    </div>
  );
}
