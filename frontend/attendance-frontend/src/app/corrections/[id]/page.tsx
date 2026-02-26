'use client';

import { useAuth } from '../../context/AuthContext';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type BusyAction = 'cancel' | 'approve' | 'reject' | null;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function getHttpStatus(err: unknown): number | null {
  const r = asRecord(err);
  if (!r) return null;

  const direct = r['status'];
  if (typeof direct === 'number') return direct;

  const resp = asRecord(r['response']);
  const respStatus = resp ? resp['status'] : null;
  if (typeof respStatus === 'number') return respStatus;

  return null;
}

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

  // ✅ 단일 유형일 때(출근/퇴근)
  // - (1) 뒤집혀 들어온 경우: 반대쪽 값이 들어오면 올바른 필드로 이동
  // - (2) 둘 다 들어온 경우: 단일 유형에서는 반대쪽 값은 표시 혼동을 유발하므로 제거
  if (d.type === 'CHECK_IN') {
    if (!inAt && outAt) {
      // 뒤집힘: out → in 으로 이동
      inAt = outAt;
      outAt = null;
    } else {
      // CHECK_IN이면 outAt은 의미 없으므로 제거(표시 혼동 방지)
      outAt = null;
    }
  }

  if (d.type === 'CHECK_OUT') {
    if (!outAt && inAt) {
      // 뒤집힘: in → out 으로 이동
      outAt = inAt;
      inAt = null;
    } else {
      // CHECK_OUT이면 inAt은 의미 없으므로 제거(표시 혼동 방지)
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

function getNestedObj(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const v = obj[key];
  if (!v || typeof v !== 'object') return null;
  return v as Record<string, unknown>;
}

function getIsoFieldFromNested(
  obj: Record<string, unknown>,
  nestedKey: string,
  keys: string[]
): string | null {
  const nested = getNestedObj(obj, nestedKey);
  if (!nested) return null;
  return getIsoField(nested, keys);
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
    ]) ??
    // 일부 응답은 attendance 객체 하위로 내려올 수 있음
    getIsoFieldFromNested(obj, 'attendance', [
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
    ]) ??
    // 일부 응답은 attendance 객체 하위로 내려올 수 있음
    getIsoFieldFromNested(obj, 'attendance', [
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
    ]) ??
    // 일부 응답은 attendance 객체 하위로 내려올 수 있음
    getIsoFieldFromNested(obj, 'attendance', [
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
    ]) ??
    // 일부 응답은 attendance 객체 하위로 내려올 수 있음
    getIsoFieldFromNested(obj, 'attendance', [
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

function CorrectionDetailPageInner() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ URL 파라미터 호환: tab 또는 scope 둘 중 하나로도 진입할 수 있음
  // - tab=approvable | my
  // - scope=approvable | requested_by_me
  const desiredTab = useMemo(() => {
    const scope = searchParams.get('scope');
    if (scope === 'approvable') return 'approvable';

    const tab = searchParams.get('tab');
    return tab === 'approvable' ? 'approvable' : 'my';
  }, [searchParams]);

  // ✅ 승인자 여부: role 기반만 사용(approvable probe 제거 → EMPLOYEE approvable 호출 방지)
  const isApprover = isApproverRole(user?.role);

  // ✅ 실제 동작 기준 탭(권한 기반): 비승인자는 항상 my로 통일
  const effectiveTab: 'my' | 'approvable' =
    desiredTab === 'approvable' && isApprover ? 'approvable' : 'my';

  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  // ✅ dev(StrictMode) 등으로 동일 조건에서 effect가 2회 호출되는 경우가 있어
  // 동일 fetchKey에 대해 "동시에" 2회 요청이 나가지 않도록 가드
  const inFlightKeyRef = useRef<string | null>(null);

  const requestId = Number(params.id);

  // ✅ 비승인자가 approvable로 접근한 경우 URL도 my로 정규화(UX 혼란 방지)
  useEffect(() => {
    if (!user) return;
    if (!Number.isFinite(requestId)) return;

    if (desiredTab === 'approvable' && !isApprover) {
      // 현재 URL에 scope=approvable 또는 tab=approvable이 남아있으면 제거
      router.replace(`/corrections/${requestId}?tab=my`);
    }
  }, [user, requestId, desiredTab, isApprover, router]);

  // ✅ 목록 복귀 시 탭 유지(최소 UX)
  const backToListUrl =
    effectiveTab === 'approvable'
      ? '/corrections?tab=approvable'
      : '/corrections?tab=my';

  const [data, setData] = useState<CorrectionRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState('');

  // 승인/반려 시 입력(최소 UX)
  const [comment, setComment] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!user) return;
    if (!Number.isFinite(requestId)) {
      setError('요청 ID가 올바르지 않습니다.');
      return;
    }

    // ✅ 상세 GET 엔드포인트 사용(루프 제거)
    // - scope는 화면 컨텍스트(effectiveTab)에 맞춰 전달
    // - approvable은 승인자만 의미가 있으므로 비승인자는 requested_by_me로 강제
    const primaryScope: 'requested_by_me' | 'approvable' =
      effectiveTab === 'approvable' && isApprover
        ? 'approvable'
        : 'requested_by_me';

    // ✅ 동일 조건의 중복 호출(특히 dev StrictMode) 방지
    const fetchKey = `${user.userId}:${requestId}:${primaryScope}`;
    if (inFlightKeyRef.current === fetchKey) return;
    inFlightKeyRef.current = fetchKey;

    setLoading(true);
    setError('');
    try {
      const buildReadUrl = (s: 'requested_by_me' | 'approvable') =>
        `${baseUrl}/api/correction-requests/${requestId}?scope=${encodeURIComponent(s)}`;

      let detail: CorrectionRequestDetail;

      try {
        detail = await apiFetch<CorrectionRequestDetail>(
          buildReadUrl(primaryScope)
        );
      } catch (e) {
        // ✅ approvable로 시도하다가 "존재하지 않음(404)"일 때만 my로 1회 fallback
        // - 403(권한 없음)에서는 scope를 바꿔도 해결되지 않음
        if (primaryScope === 'approvable') {
          const status = getHttpStatus(e);
          if (status === 404) {
            detail = await apiFetch<CorrectionRequestDetail>(
              buildReadUrl('requested_by_me')
            );
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      // ✅ 응답 필드명 호환 → 제안 시간 정규화 순으로 적용
      const compat = applyCompatLayer(detail);
      setData(normalizeProposedTimes(compat));
    } catch (e) {
      setData(null);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
      // 완료되면 다음 동일 key 호출은 허용(단, 동시에 2회만 막음)
      inFlightKeyRef.current = null;
    }
  }, [baseUrl, effectiveTab, isApprover, requestId, user]);

  async function cancelRequest() {
    if (!user) return;
    if (!data) return;

    setBusy('cancel');
    setError('');
    try {
      // 처리 후에는 진입 탭 컨텍스트를 유지한 채 목록으로 복귀
      await apiFetch(`${baseUrl}/api/correction-requests/${requestId}/cancel`, {
        method: 'POST',
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
      // 처리 후에는 진입 탭 컨텍스트를 유지한 채 목록으로 복귀
      await apiFetch(
        `${baseUrl}/api/correction-requests/${requestId}/approve`,
        {
          method: 'POST',
          // apiFetch가 JSON stringify + content-type 처리
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
      // 처리 후에는 진입 탭 컨텍스트를 유지한 채 목록으로 복귀
      await apiFetch(`${baseUrl}/api/correction-requests/${requestId}/reject`, {
        method: 'POST',
        // apiFetch가 JSON stringify + content-type 처리
        body: { reason },
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
  }, [user, fetchDetail]);

  const showCancel = !!data && data.status === 'PENDING' && !isApprover;
  const showApproveReject = !!data && data.status === 'PENDING' && isApprover;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">정정 요청 상세</h1>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => router.push(backToListUrl)}
          >
            목록
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-300">
            {effectiveTab === 'approvable'
              ? '승인 대기 탭에서 진입'
              : '내 정정 요청 탭에서 진입'}
          </span>
        </div>

        {loading && (
          <p
            className="mt-4 text-sm text-gray-600 dark:text-gray-300"
            aria-busy="true"
          >
            불러오는 중...
          </p>
        )}

        {!loading && error && (
          <p className="mt-4 text-sm text-red-600">❌ {error}</p>
        )}

        {!loading && !error && !data && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            데이터가 없습니다.
          </p>
        )}

        {!loading && !error && data && (
          <section className="mt-4 rounded border p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">요청 #{data.requestId}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">
                    요청 시각 {fmtYmdHm(data.requestedAt)}
                  </span>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
                  {data.status}
                </span>
              </div>

              <div className="text-gray-700 dark:text-gray-200">
                <div>근태 ID: {data.attendanceId}</div>
                <div>유형: {data.type}</div>

                {/* ✅ 원본(현재) vs 제안 비교 */}
                {(() => {
                  const baseIn =
                    data.currentCheckInAt ?? data.originalCheckInAt ?? null;
                  const baseOut =
                    data.currentCheckOutAt ?? data.originalCheckOutAt ?? null;
                  const propIn = data.proposedCheckInAt ?? null;
                  const propOut = data.proposedCheckOutAt ?? null;

                  const targetDate = fmtDate(
                    propIn ?? propOut ?? baseIn ?? baseOut ?? data.requestedAt
                  );

                  const summaryParts: string[] = [];
                  if (propIn && baseIn && fmtHm(propIn) !== fmtHm(baseIn)) {
                    summaryParts.push(
                      `출근 ${fmtHm(baseIn)} → ${fmtHm(propIn)}`
                    );
                  }
                  if (propOut && baseOut && fmtHm(propOut) !== fmtHm(baseOut)) {
                    summaryParts.push(
                      `퇴근 ${fmtHm(baseOut)} → ${fmtHm(propOut)}`
                    );
                  }

                  return (
                    <div className="mt-2">
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        대상 날짜: {targetDate}
                      </div>
                      {summaryParts.length > 0 ? (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          변경 요약: {summaryParts.join(' · ')}
                        </div>
                      ) : null}

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
                            제안 전
                          </div>
                          <div className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                            <div>출근: {baseIn ? fmtHm(baseIn) : '-'}</div>
                            <div>퇴근: {baseOut ? fmtHm(baseOut) : '-'}</div>
                            {!baseIn && !baseOut ? (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                                제안 전 시간이 응답에 포함되지 않았습니다.
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded border bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
                            제안
                          </div>
                          <div className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                            <div>출근: {propIn ? fmtHm(propIn) : '-'}</div>
                            <div>퇴근: {propOut ? fmtHm(propOut) : '-'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-2">
                <div className="font-medium">사유</div>
                <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 dark:bg-gray-900">
                  {data.reason ?? '-'}
                </p>
              </div>

              {data.status === 'REJECTED' && data.rejectReason ? (
                <div className="mt-2">
                  <div className="font-medium">반려 사유</div>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-red-50 p-3 dark:bg-red-900/30 dark:text-red-200">
                    {data.rejectReason}
                  </p>
                </div>
              ) : null}

              {data.status === 'APPROVED' && data.approveComment ? (
                <div className="mt-2">
                  <div className="font-medium">승인 코멘트</div>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-green-50 p-3 dark:bg-green-900/30 dark:text-green-200">
                    {data.approveComment}
                  </p>
                </div>
              ) : null}

              {showApproveReject ? (
                <div className="mt-4 rounded border bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="font-medium">승인 처리</div>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    반려 시 사유 입력이 필요합니다.
                  </p>

                  <label className="mt-3 block text-xs text-gray-700 dark:text-gray-200">
                    코멘트 / 반려 사유
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    rows={3}
                    placeholder="(선택) 승인 코멘트 또는 (필수) 반려 사유를 입력하세요"
                    disabled={busy !== null}
                  />

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-blue-500"
                      onClick={approveRequest}
                      disabled={busy !== null}
                      aria-busy={busy === 'approve'}
                    >
                      {busy === 'approve' ? '승인 처리 중...' : '승인'}
                    </button>

                    <button
                      type="button"
                      className="rounded bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-gray-700"
                      onClick={rejectRequest}
                      disabled={busy !== null}
                      aria-busy={busy === 'reject'}
                    >
                      {busy === 'reject' ? '반려 처리 중...' : '반려'}
                    </button>

                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      처리 후 목록으로 이동합니다.
                    </span>
                  </div>
                </div>
              ) : null}

              {showCancel ? (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60 dark:bg-red-500"
                    onClick={cancelRequest}
                    disabled={busy !== null}
                    aria-busy={busy === 'cancel'}
                  >
                    {busy === 'cancel' ? '취소 처리 중...' : '요청 취소'}
                  </button>

                  <span className="text-xs text-gray-600 dark:text-gray-300">
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

export default function CorrectionDetailPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900" />}
    >
      <CorrectionDetailPageInner />
    </Suspense>
  );
}
