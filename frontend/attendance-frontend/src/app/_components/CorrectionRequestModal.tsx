'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import { ApiError, type AttendanceBreakHistoryItemResponse } from '@/lib/api/types';

type EditableBreakRow = {
  id: number;
  start: string;
  end: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  baseUrl: string;
  attendanceId: number;
  targetUserId?: number | null;
  targetUserName?: string | null;
  // YYYY-MM-DD (목록 행의 workDate를 전달받아 날짜 고정)
  workDate: string;
  initialCheckInAt: string | null;
  initialCheckOutAt: string | null;
  initialBreakHistory?: AttendanceBreakHistoryItemResponse[];
  onCreated: () => void;
};

function isoToLocalTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toKstOffsetISOStringFromDateAndTime(workDate: string, time: string) {
  if (!workDate || !time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  return `${workDate}T${time}:00.000+09:00`;
}

function timeToMinutes(t: string) {
  const [hh, mm] = t.split(':');
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function formatHm(iso: string | null) {
  return isoToLocalTime(iso) || '--:--';
}

export default function CorrectionRequestModal({
  open,
  onClose,
  baseUrl,
  attendanceId,
  targetUserId,
  targetUserName,
  workDate,
  initialCheckInAt,
  initialCheckOutAt,
  initialBreakHistory,
  onCreated,
}: Props) {
  const [checkInLocal, setCheckInLocal] = useState('');
  const [checkOutLocal, setCheckOutLocal] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info');
  const [isBreakEditOpen, setIsBreakEditOpen] = useState(false);
  const [breakRows, setBreakRows] = useState<EditableBreakRow[]>([]);
  const breakRowSeqRef = useRef(1);

  useEffect(() => {
    if (!open) return;

    setCheckInLocal(isoToLocalTime(initialCheckInAt));
    setCheckOutLocal(isoToLocalTime(initialCheckOutAt));
    setReason('');
    setMessage('');
    setMessageTone('info');
    setLoading(false);
    setIsBreakEditOpen(false);

    const nextRows = (initialBreakHistory ?? []).map((b, idx) => ({
      id: idx + 1,
      start: isoToLocalTime(b.breakStartAt),
      end: isoToLocalTime(b.breakEndAt),
    }));
    breakRowSeqRef.current = nextRows.length + 1;
    setBreakRows(nextRows);
  }, [open, initialCheckInAt, initialCheckOutAt, initialBreakHistory]);

  const isTimeOrderValid = useMemo(() => {
    if (!checkInLocal || !checkOutLocal) return true;
    const inMin = timeToMinutes(checkInLocal);
    const outMin = timeToMinutes(checkOutLocal);
    if (Number.isNaN(inMin) || Number.isNaN(outMin)) return true;
    return inMin <= outMin;
  }, [checkInLocal, checkOutLocal]);

  const breakValidationMessage = useMemo(() => {
    if (!isBreakEditOpen) return '';
    for (const row of breakRows) {
      if (!row.start || !row.end) {
        return '휴게 시작/종료 시간을 모두 입력해 주세요.';
      }
      const startMin = timeToMinutes(row.start);
      const endMin = timeToMinutes(row.end);
      if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
        return '휴게 시간 형식이 올바르지 않습니다.';
      }
      if (startMin >= endMin) {
        return '휴게 시작 시간은 종료 시간보다 빨라야 합니다.';
      }
    }

    const sorted = [...breakRows].sort((a, b) => {
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (timeToMinutes(cur.start) < timeToMinutes(prev.end)) {
        return '휴게 시간이 겹칠 수 없습니다.';
      }
    }

    if (!checkInLocal || !checkOutLocal) {
      return '휴게 수정 시 제안 출근/퇴근 시간을 먼저 입력해 주세요.';
    }
    const workStart = timeToMinutes(checkInLocal);
    const workEnd = timeToMinutes(checkOutLocal);
    if (Number.isNaN(workStart) || Number.isNaN(workEnd) || workStart > workEnd) {
      return '휴게 수정 전에 제안 출근/퇴근 시간을 확인해 주세요.';
    }

    for (const row of breakRows) {
      const startMin = timeToMinutes(row.start);
      const endMin = timeToMinutes(row.end);
      if (startMin < workStart || endMin > workEnd) {
        return '휴게 시간은 제안 출근~퇴근 구간 내여야 합니다.';
      }
    }

    return '';
  }, [isBreakEditOpen, breakRows, checkInLocal, checkOutLocal]);

  const canSubmit = useMemo(() => {
    if (!reason.trim()) return false;
    if (!checkInLocal || !checkOutLocal) return false;
    if (!isTimeOrderValid) return false;
    if (breakValidationMessage) return false;
    return true;
  }, [
    reason,
    checkInLocal,
    checkOutLocal,
    isTimeOrderValid,
    breakValidationMessage,
  ]);

  const missingHint = useMemo(() => {
    if (!reason.trim()) return '사유를 입력해 주세요.';
    if (!checkInLocal || !checkOutLocal) {
      return '제안 출근/퇴근 시간을 모두 선택해 주세요.';
    }
    if (!isTimeOrderValid) {
      return '출근 시간은 퇴근 시간보다 늦을 수 없습니다.';
    }
    if (breakValidationMessage) return breakValidationMessage;
    return '';
  }, [
    reason,
    checkInLocal,
    checkOutLocal,
    isTimeOrderValid,
    breakValidationMessage,
  ]);

  const targetLabel = useMemo(() => {
    const idText =
      typeof targetUserId === 'number' && Number.isFinite(targetUserId)
        ? `#${targetUserId}`
        : '';
    const nameText = targetUserName?.trim() ? targetUserName.trim() : '';
    return `${nameText}${nameText && idText ? ' ' : ''}${idText}`.trim();
  }, [targetUserId, targetUserName]);

  if (!open) return null;

  const submit = async () => {
    if (!canSubmit || loading) return;

    const proposedCheckInAt = toKstOffsetISOStringFromDateAndTime(
      workDate,
      checkInLocal
    );
    const proposedCheckOutAt = toKstOffsetISOStringFromDateAndTime(
      workDate,
      checkOutLocal
    );

    const proposedBreaks = isBreakEditOpen
      ? breakRows.map((row) => ({
          proposedBreakStartAt: toKstOffsetISOStringFromDateAndTime(
            workDate,
            row.start
          ),
          proposedBreakEndAt: toKstOffsetISOStringFromDateAndTime(
            workDate,
            row.end
          ),
        }))
      : undefined;

    setLoading(true);
    setMessage('');
    setMessageTone('info');
    try {
      await apiFetch(`${baseUrl}/api/attendance/${attendanceId}/correction-requests`, {
        method: 'POST',
        body: {
          proposedCheckInAt,
          proposedCheckOutAt,
          proposedBreaks,
          reason: reason.trim(),
        },
      });

      onClose();
      onCreated();
    } catch (e) {
      const msg = toUserMessage(e);
      setMessage(msg);
      setMessageTone('error');

      if (e instanceof ApiError && e.code === 'PENDING_REQUEST_EXISTS') {
        const targetHint = targetLabel ? `대상 ${targetLabel} · ` : '';
        setMessage(
          `이미 승인 대기 중인 정정 요청이 있습니다. ${targetHint}${workDate} 건을 확인해 주세요.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-busy={loading}
    >
      <div className="w-full max-w-xl rounded-lg bg-white p-4 shadow text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">정정 요청</h2>
            <p className="text-xs text-gray-500 dark:text-gray-300">
              {targetLabel
                ? `대상: ${targetLabel} · ${workDate}`
                : `대상 날짜: ${workDate}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onClose}
            disabled={loading}
          >
            닫기
          </button>
        </div>

        <section className="mb-3 rounded border border-gray-300 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
          <div className="font-medium">현재 출/퇴근 및 휴게 이력</div>
          <div className="mt-2 grid gap-1">
            <div>현재 출근: {formatHm(initialCheckInAt)}</div>
            <div>현재 퇴근: {formatHm(initialCheckOutAt)}</div>
          </div>
          <div className="mt-2">
            {(initialBreakHistory ?? []).length === 0 ? (
              <div className="text-gray-500 dark:text-gray-300">
                휴게 이력이 없습니다.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 text-left dark:border-gray-700">
                      <th className="p-1.5">#</th>
                      <th className="p-1.5">휴게 구간</th>
                      <th className="p-1.5">휴게시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(initialBreakHistory ?? []).map((b, idx) => (
                      <tr
                        key={`current-break-${idx}`}
                        className="border-b border-gray-200 dark:border-gray-800"
                      >
                        <td className="p-1.5">{idx + 1}</td>
                        <td className="p-1.5">
                          {formatHm(b.breakStartAt)} ~ {formatHm(b.breakEndAt)}
                        </td>
                        <td className="p-1.5">{b.breakMinutes}분</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">제안 출근 시간</label>
          <input
            type="time"
            className="w-full rounded border px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            value={checkInLocal}
            onChange={(e) => setCheckInLocal(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">제안 퇴근 시간</label>
          <input
            type="time"
            className="w-full rounded border px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            value={checkOutLocal}
            onChange={(e) => setCheckOutLocal(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="mb-3">
          <button
            type="button"
            className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
            disabled={loading}
            onClick={() => setIsBreakEditOpen((v) => !v)}
          >
            {isBreakEditOpen ? '휴게정보 수정 접기' : '휴게정보 수정'}
          </button>

          {isBreakEditOpen && (
            <div className="mt-2 rounded border border-gray-300 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium">제안 휴게 이력</div>
                <button
                  type="button"
                  className="rounded border border-gray-400 px-2 py-1 text-[11px] hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  disabled={loading}
                  onClick={() => {
                    const nextId = breakRowSeqRef.current++;
                    setBreakRows((prev) => [
                      ...prev,
                      { id: nextId, start: '', end: '' },
                    ]);
                  }}
                >
                  휴게 추가
                </button>
              </div>

              {breakRows.length === 0 ? (
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  등록된 휴게 이력이 없습니다. 필요하면 휴게 추가 버튼으로 입력해 주세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {breakRows.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-[24px_1fr_1fr_auto] items-center gap-2">
                      <span className="text-xs text-gray-500">{idx + 1}</span>
                      <input
                        type="time"
                        value={row.start}
                        onChange={(e) =>
                          setBreakRows((prev) =>
                            prev.map((x) =>
                              x.id === row.id ? { ...x, start: e.target.value } : x
                            )
                          )
                        }
                        disabled={loading}
                        className="rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                      <input
                        type="time"
                        value={row.end}
                        onChange={(e) =>
                          setBreakRows((prev) =>
                            prev.map((x) =>
                              x.id === row.id ? { ...x, end: e.target.value } : x
                            )
                          )
                        }
                        disabled={loading}
                        className="rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                      <button
                        type="button"
                        className="rounded border border-gray-400 px-2 py-1 text-[11px] hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                        disabled={loading}
                        onClick={() =>
                          setBreakRows((prev) => prev.filter((x) => x.id !== row.id))
                        }
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">사유</label>
          <textarea
            className="w-full rounded border px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            placeholder="정정 사유를 입력하세요"
          />
          {!loading && missingHint && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">{missingHint}</p>
          )}
        </div>

        {message ? (
          <p
            className={
              messageTone === 'error'
                ? 'mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200'
                : 'mt-3 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-200'
            }
          >
            {message}
          </p>
        ) : null}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded bg-gray-100 px-3 py-2 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            className="flex-1 rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
            onClick={submit}
            disabled={!canSubmit || loading}
          >
            {loading ? '처리 중...' : '요청하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
