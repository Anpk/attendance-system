'use client';

import { useAuth } from '../../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

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
  // ✅ 제안 전(원본/현재) 출퇴근(백엔드 구현에 따라 둘 중 하나가 내려올 수 있어 optional)
  currentCheckInAt?: string | null; // ISO
  currentCheckOutAt?: string | null; // ISO
  originalCheckInAt?: string | null; // ISO
  originalCheckOutAt?: string | null; // ISO
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

type BusyAction = 'cancel' | 'approve' | 'reject' | null;

function isApproverRole(role?: string): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return iso;
  }
}

function fmtHm(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return iso;
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

function normalizeProposedTimes(
  d: CorrectionRequestDetail
): CorrectionRequestDetail {
  let inAt: string | null = d.proposedCheckInAt ?? null;
  let outAt: string | null = d.proposedCheckOutAt ?? null;

  // ✅ 단일 유형일 때(출근/퇴근) 백엔드 필드가 한 쪽만 채워지거나 반대로 들어오는 경우를 방어
  if (d.type === 'CHECK_IN') {
    if (!inAt && outAt) {
      inAt = outAt;
      outAt = null;
    }
  }

  if (d.type === 'CHECK_OUT') {
    if (!outAt && inAt) {
      outAt = inAt;
      inAt = null;
    }
  }

  // ✅ BOTH인데 시간 순서가 뒤집혀 있으면(클라이언트 표시 기준) swap
  if (d.type === 'BOTH' && inAt && outAt) {
    try {
      if (new Date(inAt).getTime() > new Date(outAt).getTime()) {
        const tmp = inAt;
        inAt = outAt;
        outAt = tmp;
      }
    } catch {
      // 파싱 실패 시 원본 유지
    }
  }

  return {
    ...d,
    proposedCheckInAt: inAt,
    proposedCheckOutAt: outAt,
  };
}

function getIsoField(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

function applyCompatLayer(d: CorrectionRequestDetail): CorrectionRequestDetail {
  const obj = d as unknown as Record<string, unknown>;

  // ✅ 제안(요청) 시간: 필드명 호환
  const proposedIn =
    d.proposedCheckInAt ??
    getIsoField(obj, [
      'proposedCheckInAt',
      'proposed_check_in_at',
      'proposedCheckInTime',
      'proposedCheckIn',
      'checkInProposedAt',
    ]);

  const proposedOut =
    d.proposedCheckOutAt ??
    getIsoField(obj, [
      'proposedCheckOutAt',
      'proposed_check_out_at',
      'proposedCheckOutTime',
      'proposedCheckOut',
      'checkOutProposedAt',
    ]);

  // ✅ 제안 전(원본/현재) 시간: 필드명 호환
  // - 어떤 백엔드는 "current", 어떤 백엔드는 "final/before/base/checkInAt" 등으로 내려줄 수 있음
  const currentIn =
    d.currentCheckInAt ??
    getIsoField(obj, [
      'currentCheckInAt',
      'finalCheckInAt',
      'beforeCheckInAt',
      'baseCheckInAt',
      'checkInAt',
      'attendanceCheckInAt',
    ]);

  const currentOut =
    d.currentCheckOutAt ??
    getIsoField(obj, [
      'currentCheckOutAt',
      'finalCheckOutAt',
      'beforeCheckOutAt',
      'baseCheckOutAt',
      'checkOutAt',
      'attendanceCheckOutAt',
    ]);

  const originalIn =
    d.originalCheckInAt ??
    getIsoField(obj, [
      'originalCheckInAt',
      'original_check_in_at',
      'originCheckInAt',
    ]);

  const originalOut =
    d.originalCheckOutAt ??
    getIsoField(obj, [
      'originalCheckOutAt',
      'original_check_out_at',
      'originCheckOutAt',
    ]);

  return {
    ...d,
    proposedCheckInAt: proposedIn ?? undefined,
    proposedCheckOutAt: proposedOut ?? undefined,
    currentCheckInAt: currentIn ?? undefined,
    currentCheckOutAt: currentOut ?? undefined,
    originalCheckInAt: originalIn ?? undefined,
    originalCheckOutAt: originalOut ?? undefined,
  };
}

export default function CorrectionDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const scope = (searchParams.get('scope') ?? '').trim();

  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const requestId = Number(params.id);

  // ✅ 목록 복귀 시 탭 유지(최소 UX)
  // - 승인 대기 탭에서 들어오면 scope=approvable
  const backToListUrl =
    scope === 'approvable'
      ? '/corrections?tab=approvable'
      : '/corrections?tab=my';

  const [data, setData] = useState<CorrectionRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState('');

  // 승인/반려 시 입력(최소 UX)
  const [comment, setComment] = useState('');

  const roleBasedApprover = useMemo(() => {
    return isApproverRole(user?.role);
  }, [user?.role]);

  // ✅ role 정보가 없거나 신뢰할 수 없는 경우를 대비해 approvable 조회를 1회 호출해 승인 권한을 판정
  const [canApprove, setCanApprove] = useState<boolean | null>(null);

  const isApprover = roleBasedApprover || canApprove === true;

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
      // 단, 상세 진입이 "내 요청"인지 "승인 대기"인지에 따라 scope가 달라질 수 있으므로
      // (1) URL 파라미터 scope 우선, (2) requested_by_me, (3) approvable(승인자) 순으로 탐색한다.
      const scopeParam = (searchParams.get('scope') ?? '').trim();
      const candidates = [
        scopeParam,
        'requested_by_me',
        isApprover ? 'approvable' : '',
        user?.role === 'ADMIN' ? 'all' : '',
      ].filter((x) => !!x);

      // 중복 제거
      const scopes = Array.from(new Set(candidates));

      let found: CorrectionRequestDetail | null = null;

      for (const s of scopes) {
        const res = await apiFetch<CorrectionRequestListResponse>(
          `${baseUrl}/api/correction-requests?scope=${encodeURIComponent(
            s
          )}&page=0&size=200`,
          { headers: { 'X-USER-ID': String(user.userId) } }
        );

        found =
          (res.items ?? []).find((x) => x.requestId === requestId) ?? null;
        if (found) break;
      }

      if (!found) {
        setData(null);
        setError('해당 정정 요청을 찾을 수 없습니다.');
        return;
      }

      // ✅ 응답 필드명 호환 → 제안 시간 정규화 순으로 적용
      const compat = applyCompatLayer(found);
      setData(normalizeProposedTimes(compat));
    } catch (e) {
      setData(null);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;

    // role로 이미 승인자 판정이 가능하면 확정
    if (roleBasedApprover) {
      setCanApprove(true);
      return;
    }

    // 이미 판정 완료되었으면 재호출하지 않음
    if (canApprove !== null) return;

    // ✅ 최소 호출: 승인 대기(scope=approvable) 목록을 size=1로 요청해 200/403로 판정
    (async () => {
      try {
        await apiFetch<CorrectionRequestListResponse>(
          `${baseUrl}/api/correction-requests?scope=approvable&status=PENDING&page=0&size=1`,
          { headers: { 'X-USER-ID': String(user.userId) } }
        );
        setCanApprove(true);
      } catch {
        // 403(FORBIDDEN) 포함 어떤 실패든 "승인 불가"로 처리(안전)
        setCanApprove(false);
      }
    })();
  }, [user, baseUrl, roleBasedApprover, canApprove]);

  async function cancelRequest() {
    if (!user) return;
    if (!data) return;

    setBusy('cancel');
    setError('');
    try {
      // ✅ 기존 합의/구현에 맞춤: POST /api/correction-requests/{id}/cancel
      await apiFetch(`${baseUrl}/api/correction-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'X-USER-ID': String(user.userId) },
      });
      // 취소 후 목록으로 이동(모바일 UX: 뒤로가기 일관)
      router.push(backToListUrl);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function approveRequest() {
    if (!user) return;
    if (!data) return;

    setBusy('approve');
    setError('');
    try {
      // 계약: POST /api/correction-requests/{id}/approve
      // 코멘트는 선택(백엔드가 미사용이어도 {}로 안전하게 전송)
      await apiFetch(
        `${baseUrl}/api/correction-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-USER-ID': String(user.userId),
          },
          // apiFetch에서 JSON 직렬화를 처리하므로 객체 그대로 전달(중복 stringify 방지)
          body: { approveComment: comment.trim() || null },
        }
      );
      router.push(backToListUrl);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function rejectRequest() {
    if (!user) return;
    if (!data) return;

    const reason = comment.trim();
    if (!reason) {
      setError('반려 사유를 입력해 주세요.');
      return;
    }

    setBusy('reject');
    setError('');
    try {
      // 계약: POST /api/correction-requests/{id}/reject
      await apiFetch(`${baseUrl}/api/correction-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-USER-ID': String(user.userId),
        },
        // apiFetch에서 JSON 직렬화를 처리하므로 객체 그대로 전달(중복 stringify 방지)
        body: { rejectReason: reason },
      });
      router.push(backToListUrl);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, requestId, baseUrl]);

  const showCancel =
    !!data &&
    data.status === 'PENDING' &&
    scope !== 'approvable' &&
    !isApprover;
  const showApproveReject = !!data && data.status === 'PENDING' && isApprover;

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정 요청 상세</h1>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => router.push(backToListUrl)}
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
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">요청 #{data.requestId}</span>
                  <span className="text-xs text-gray-500">
                    요청 시각 {fmtYmdHm(data.requestedAt)}
                  </span>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  {data.status}
                </span>
              </div>

              <div className="text-gray-700">
                <div>근태 ID: {data.attendanceId}</div>
                <div>유형: {data.type}</div>

                {/* ✅ 제안 전(원본/현재) 시간 표시 */}
                {data.currentCheckInAt ||
                data.currentCheckOutAt ||
                data.originalCheckInAt ||
                data.originalCheckOutAt ? (
                  <div className="mt-2 rounded bg-gray-50 p-3">
                    <div className="text-xs font-medium text-gray-700">
                      제안 전
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {(() => {
                        const inAt =
                          data.currentCheckInAt ??
                          data.originalCheckInAt ??
                          null;
                        const outAt =
                          data.currentCheckOutAt ??
                          data.originalCheckOutAt ??
                          null;
                        const targetDate = fmtDate(
                          inAt ?? outAt ?? data.requestedAt
                        );

                        return (
                          <div className="flex flex-col gap-1">
                            <div>대상 날짜: {targetDate}</div>
                            {inAt ? <div>출근: {fmtHm(inAt)}</div> : null}
                            {outAt ? <div>퇴근: {fmtHm(outAt)}</div> : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}

                {/* ✅ 수정 대상 날짜는 변하지 않으므로 제안 시간(시:분)과 분리 표시 */}
                {data.proposedCheckInAt || data.proposedCheckOutAt ? (
                  <>
                    <div>
                      대상 날짜:{' '}
                      {fmtDate(
                        data.proposedCheckInAt ??
                          data.proposedCheckOutAt ??
                          null
                      )}
                    </div>

                    {/* ✅ 값이 있는 항목만 표시(불필요한 '-' 라인 숨김) */}
                    {data.proposedCheckInAt ? (
                      <div>제안 출근: {fmtHm(data.proposedCheckInAt)}</div>
                    ) : null}

                    {data.proposedCheckOutAt ? (
                      <div>제안 퇴근: {fmtHm(data.proposedCheckOutAt)}</div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-xs text-gray-500">
                    제안 시간이 없어 대상 날짜/시간을 표시할 수 없습니다.
                  </div>
                )}
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

              {showApproveReject ? (
                <div className="mt-4 rounded border bg-gray-50 p-3">
                  <div className="font-medium">승인 처리</div>
                  <p className="mt-1 text-xs text-gray-600">
                    반려 시 사유 입력이 필요합니다.
                  </p>

                  <label className="mt-3 block text-xs text-gray-700">
                    코멘트 / 반려 사유
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    rows={3}
                    placeholder="(선택) 승인 코멘트 또는 (필수) 반려 사유를 입력하세요"
                    disabled={busy !== null}
                  />

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                      onClick={approveRequest}
                      disabled={busy !== null}
                      aria-busy={busy === 'approve'}
                    >
                      {busy === 'approve' ? '승인 처리 중...' : '승인'}
                    </button>

                    <button
                      type="button"
                      className="rounded bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-60"
                      onClick={rejectRequest}
                      disabled={busy !== null}
                      aria-busy={busy === 'reject'}
                    >
                      {busy === 'reject' ? '반려 처리 중...' : '반려'}
                    </button>

                    <span className="text-xs text-gray-600">
                      처리 후 목록으로 이동합니다.
                    </span>
                  </div>
                </div>
              ) : null}

              {showCancel ? (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                    onClick={cancelRequest}
                    disabled={busy !== null}
                    aria-busy={busy === 'cancel'}
                  >
                    {busy === 'cancel' ? '취소 처리 중...' : '요청 취소'}
                  </button>

                  <span className="text-xs text-gray-600">
                    취소 후에는 목록에서 다시 확인해 주세요.
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
