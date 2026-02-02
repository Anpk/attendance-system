'use client';

import { useAuth } from '../../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import AppHeader from '@/app/_components/AppHeader';
import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type CorrectionRequestDetail = {
  requestId: number;
  attendanceId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';
  requestedAt: string; // ISO
  // 아래 필드들은 "목록 응답"에 포함되지 않을 수 있어 optional로 둔다(최소 diff)
  proposedCheckInAt?: string | null; // ISO
  proposedCheckOutAt?: string | null; // ISO
  reason?: string;
  processedAt?: string | null;
  approveComment?: string | null;
  rejectReason?: string | null;
};

type CorrectionRequestListResponse = {
  items: CorrectionRequestDetail[];
  page: number;
  size: number;
  totalElements: number;
};

export default function CorrectionDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const requestId = Number(params.id);

  const [data, setData] = useState<CorrectionRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function fetchDetail() {
    if (!user) return;
    if (!Number.isFinite(requestId)) {
      setError('요청 ID가 올바르지 않습니다.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // 계약 기준: 상세 GET은 없음 → 목록 API로 가져온 뒤 requestId로 필터링
      // scope는 "내가 요청한 것" 기준. (요청함 화면의 의미)
      const res = await apiFetch<CorrectionRequestListResponse>(
        `${baseUrl}/api/correction-requests?scope=requested_by_me&page=0&size=200`,
        { headers: { 'X-USER-ID': String(user.userId) } }
      );

      const found =
        (res.items ?? []).find((x) => x.requestId === requestId) ?? null;
      if (!found) {
        setData(null);
        setError('해당 정정 요청을 찾을 수 없습니다.');
        return;
      }
      setData(found);
    } catch (e) {
      setData(null);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function cancelRequest() {
    if (!user) return;
    if (!data) return;

    setBusy(true);
    setError('');
    try {
      // ✅ 기존 합의/구현에 맞춤: POST /api/correction-requests/{id}/cancel
      await apiFetch(`${baseUrl}/api/correction-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'X-USER-ID': String(user.userId) },
      });
      // 취소 후 목록으로 이동(모바일 UX: 뒤로가기 일관)
      router.push('/corrections');
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, requestId, baseUrl]);

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정 요청 상세</h1>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => router.push('/corrections')}
          >
            목록
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-gray-600" aria-busy="true">
            불러오는 중...
          </p>
        )}

        {!loading && error && (
          <p className="mt-4 text-sm text-red-600">❌ {error}</p>
        )}

        {!loading && !error && !data && (
          <p className="mt-4 text-sm text-gray-600">데이터가 없습니다.</p>
        )}

        {!loading && !error && data && (
          <section className="mt-4 rounded border p-4 text-sm">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">요청 #{data.requestId}</span>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  {data.status}
                </span>
              </div>

              <div className="text-gray-700">
                <div>근태 ID: {data.attendanceId}</div>
                <div>유형: {data.type}</div>
                <div>요청 시각: {data.requestedAt}</div>
                <div>제안 출근: {data.proposedCheckInAt ?? '-'}</div>
                <div>제안 퇴근: {data.proposedCheckOutAt ?? '-'}</div>
              </div>

              <div className="mt-2">
                <div className="font-medium">사유</div>
                <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3">
                  {data.reason ?? '-'}
                </p>
              </div>

              {data.status === 'REJECTED' && data.rejectReason ? (
                <div className="mt-2">
                  <div className="font-medium">반려 사유</div>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-red-50 p-3">
                    {data.rejectReason}
                  </p>
                </div>
              ) : null}

              {data.status === 'APPROVED' && data.approveComment ? (
                <div className="mt-2">
                  <div className="font-medium">승인 코멘트</div>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-green-50 p-3">
                    {data.approveComment}
                  </p>
                </div>
              ) : null}

              {data.status === 'PENDING' && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                    onClick={cancelRequest}
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? '취소 처리 중...' : '요청 취소'}
                  </button>

                  <span className="text-xs text-gray-600">
                    취소 후에는 목록에서 다시 확인해 주세요.
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
