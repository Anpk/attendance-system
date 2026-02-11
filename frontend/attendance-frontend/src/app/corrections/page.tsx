'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AppHeader from '@/app/_components/AppHeader';
import type { CorrectionRequestListItem } from '@/app/_components/CorrectionRequestDetailModal';
import { apiFetch } from '@/lib/api/client';

import { toUserMessage } from '@/lib/api/error-messages';

function badgeClass(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-blue-100 text-blue-800';
    case 'APPROVED':
      return 'bg-green-100 text-green-800';
    case 'REJECTED':
      return 'bg-red-100 text-red-800';
    case 'CANCELED':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function fmtYmdHm(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

function getOptionalStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

type CorrectionRequestListResponse = {
  items: CorrectionRequestListItem[];
  page: number;
  size: number;
  totalElements: number;
};

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

function toEpochMillis(iso: string | null, fallback: number): number {
  if (!iso) return fallback;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : fallback;
}

export default function CorrectionsPage() {
  const { user } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ 승인자만 승인 대기 탭 노출 (프론트 가드)
  // - role 기반만 사용 (최소/명확): MANAGER/ADMIN만 approvable 탭 접근 가능
  const isApprover = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  // tab=my | approvable (기본 my)
  const tab = searchParams.get('tab') === 'approvable' ? 'approvable' : 'my';

  // ✅ 실제 동작 기준 탭(권한 기반): 비승인자는 항상 my로 강제
  const effectiveTab: 'my' | 'approvable' = !isApprover ? 'my' : tab;

  // 기존 정책 유지(최소 diff): env 없으면 localhost fallback
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

  const [items, setItems] = useState<CorrectionRequestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const fetchList = useCallback(async () => {
    if (!user) return;

    // ✅ URL이 approvable로 들어와도(직접 입력/즐겨찾기 등) 화면/호출 모두 my로 통일
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

      const data = await apiFetch<CorrectionRequestListResponse>(url);
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user, baseUrl, tab, isApprover, router, effectiveTab]);

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
    // ✅ 비승인자는 approvable로 전환 불가(표시/접근 일관성)
    if (next === 'approvable' && !isApprover) {
      router.replace('/corrections?tab=my');
      return;
    }

    // URL로 탭 상태 유지(뒤로가기 UX 포함)
    setStatusFilter('ALL');
    const q = next === 'approvable' ? '?tab=approvable' : '?tab=my';
    router.replace(`/corrections${q}`);
  }

  const displayedItems = useMemo(() => {
    // ✅ 목록 UX 보강(최소): 상태 필터 + 요청시각 내림차순 정렬
    // - 서버 정렬/필터가 아직 없다면 클라이언트에서 1차 대응
    const filtered =
      effectiveTab === 'my' && statusFilter !== 'ALL'
        ? items.filter((it) => String(it.status) === statusFilter)
        : items;

    // requestedAt이 없을 수 있으므로 requestId로 fallback(내림차순)
    return [...filtered].sort((a, b) => {
      const aRequestedAt = getOptionalStringField(a, 'requestedAt');
      const bRequestedAt = getOptionalStringField(b, 'requestedAt');

      const aKey = toEpochMillis(aRequestedAt, Number(a.requestId) || 0);
      const bKey = toEpochMillis(bRequestedAt, Number(b.requestId) || 0);

      return bKey - aKey;
    });
  }, [items, effectiveTab, statusFilter]);

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
              effectiveTab === 'my'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-800'
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
                effectiveTab === 'approvable'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
              disabled={loading}
            >
              정정 승인 대기
            </button>
          )}
        </div>
        {effectiveTab === 'my' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['ALL', '전체'],
                ['PENDING', '대기'],
                ['APPROVED', '승인'],
                ['REJECTED', '반려'],
                ['CANCELED', '취소'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded px-3 py-2 text-xs ${
                  statusFilter === value
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p className="mt-4 text-sm text-gray-600" aria-busy="true">
            목록 불러오는 중...
          </p>
        )}

        {!loading && error && (
          <p className="mt-4 text-sm text-red-600">❌ {error}</p>
        )}

        {!loading && !error && displayedItems.length === 0 && (
          <p className="mt-4 text-sm text-gray-600">
            {effectiveTab === 'my'
              ? '표시할 정정 요청이 없습니다.'
              : '승인 대기 요청이 없습니다.'}
          </p>
        )}

        {!loading && !error && displayedItems.length > 0 && (
          <section className="mt-4 rounded border">
            <ul className="divide-y">
              {displayedItems.map((it) => {
                const requestedAt = getOptionalStringField(it, 'requestedAt');
                const workDate = getOptionalStringField(it, 'workDate');

                return (
                  <li key={it.requestId} className="px-4 py-3 text-sm">
                    <Link
                      href={
                        effectiveTab === 'approvable'
                          ? `/corrections/${it.requestId}?tab=approvable`
                          : `/corrections/${it.requestId}?tab=my`
                      }
                      className="block w-full"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">
                              요청 #{it.requestId}
                            </span>
                            <span className="text-xs text-gray-500">
                              {fmtYmdHm(requestedAt)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-gray-600">
                            <span
                              className={`rounded px-2 py-1 text-xs ${badgeClass(String(it.status))}`}
                            >
                              {it.status}
                            </span>

                            {workDate ? (
                              <span className="text-xs text-gray-600">
                                대상 {workDate}
                              </span>
                            ) : null}

                            {effectiveTab === 'approvable' ? (
                              <span className="text-xs text-gray-600">
                                요청자 {it.requestedBy}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">상세 보기</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
