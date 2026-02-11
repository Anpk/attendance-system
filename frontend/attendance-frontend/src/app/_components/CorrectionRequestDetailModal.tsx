'use client';

import { useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

export type CorrectionRequestListItem = {
  requestId: number;
  attendanceId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';
  requestedBy: number;
  requestedAt: string;

  // 아래 필드는 백엔드 응답에 포함될 수도/없을 수도 있어서 optional 처리
  proposedCheckInAt?: string | null;
  proposedCheckOutAt?: string | null;
  reason?: string;

  approvedAt?: string | null;
  approvedBy?: number | null;
  rejectedAt?: string | null;
  rejectedBy?: number | null;
  canceledAt?: string | null;
  processedAt?: string | null;
  processedBy?: number | null;
  approveComment?: string | null;
  rejectReason?: string | null;
};

type Props = {
  baseUrl: string;
  item: CorrectionRequestListItem;
  onClose: () => void;
  onCanceled: () => void;
};

function fmtIso(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    // 로컬(브라우저) 기준 표시
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function CorrectionRequestDetailModal({
  baseUrl,
  item,
  onClose,
  onCanceled,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canCancel = useMemo(() => item.status === 'PENDING', [item.status]);

  async function handleCancel() {
    if (!canCancel) return;
    setSubmitting(true);
    setError('');
    try {
      // 계약: 취소는 POST /api/correction-requests/{requestId}/cancel
      await apiFetch(
        `${baseUrl}/api/correction-requests/${item.requestId}/cancel`,
        {
          method: 'POST',
        }
      );

      // 취소 성공 시 목록 재조회 유도
      onCanceled();
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded bg-white p-4 shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">정정 요청 상세</h2>
            <p className="mt-1 text-xs text-gray-600">
              요청 #{item.requestId} · 근태 #{item.attendanceId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">상태</span>
            <span className="font-medium">{item.status}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">유형</span>
            <span className="font-medium">{item.type}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">요청 시각</span>
            <span className="font-medium">{fmtIso(item.requestedAt)}</span>
          </div>

          <div className="rounded border p-3">
            <div className="text-xs font-semibold text-gray-700">제안 시간</div>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">출근</span>
                <span className="font-medium">
                  {fmtIso(item.proposedCheckInAt ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">퇴근</span>
                <span className="font-medium">
                  {fmtIso(item.proposedCheckOutAt ?? null)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="text-xs font-semibold text-gray-700">사유</div>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {item.reason && item.reason.trim().length > 0 ? item.reason : '-'}
            </p>
          </div>

          {(item.approveComment || item.rejectReason) && (
            <div className="rounded border p-3">
              <div className="text-xs font-semibold text-gray-700">
                처리 코멘트
              </div>
              {item.approveComment && (
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {item.approveComment}
                </p>
              )}
              {item.rejectReason && (
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {item.rejectReason}
                </p>
              )}
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">❌ {error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!canCancel || submitting}
            aria-busy={submitting}
            className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitting ? '취소 중...' : '요청 취소'}
          </button>
        </div>
      </div>
    </div>
  );
}
