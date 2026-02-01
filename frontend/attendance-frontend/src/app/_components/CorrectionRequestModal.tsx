'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type CorrectionType = 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';

type Props = {
  open: boolean;
  onClose: () => void;
  baseUrl: string;
  userId: number;
  attendanceId: number;
  // YYYY-MM-DD (목록 행의 workDate를 전달받아 날짜 고정)
  workDate: string;
  initialCheckInAt: string | null;
  initialCheckOutAt: string | null;
  onCreated: () => void;
};

function isoToLocalTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  // time: HH:mm
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toKstOffsetISOStringFromDateAndTime(workDate: string, time: string) {
  // workDate: "YYYY-MM-DD"
  // time: "HH:mm"
  // 서버가 +09:00 offset 포함 ISO를 기대하므로, KST 기준 문자열로 조립한다.
  if (!workDate || !time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  return `${workDate}T${time}:00.000+09:00`;
}

export default function CorrectionRequestModal({
  open,
  onClose,
  baseUrl,
  userId,
  attendanceId,
  workDate,
  initialCheckInAt,
  initialCheckOutAt,
  onCreated,
}: Props) {
  const [type, setType] = useState<CorrectionType>('BOTH');
  const [checkInLocal, setCheckInLocal] = useState('');
  const [checkOutLocal, setCheckOutLocal] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 모달 열릴 때 초기값 세팅
  useEffect(() => {
    if (!open) return;
    setType('BOTH');
    setCheckInLocal(isoToLocalTime(initialCheckInAt));
    setCheckOutLocal(isoToLocalTime(initialCheckOutAt));
    setReason('');
    setMessage('');
    setLoading(false);
  }, [open, initialCheckInAt, initialCheckOutAt]);

  function timeToMinutes(t: string) {
    // "HH:mm" -> minutes
    const [hh, mm] = t.split(':');
    const h = Number(hh);
    const m = Number(mm);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
  }

  const isTimeOrderValid = useMemo(() => {
    // 1차 가드: 가능한 정보가 있을 때만 "출근 ≤ 퇴근" 검증
    // - BOTH: 입력 출근/퇴근으로 검증
    // - CHECK_IN: 입력 출근 + 기존 퇴근(있으면)으로 검증
    // - CHECK_OUT: 기존 출근(있으면) + 입력 퇴근으로 검증

    const existingIn = initialCheckInAt ? isoToLocalTime(initialCheckInAt) : '';
    const existingOut = initialCheckOutAt
      ? isoToLocalTime(initialCheckOutAt)
      : '';

    let effectiveIn = '';
    let effectiveOut = '';

    if (type === 'BOTH') {
      if (!checkInLocal || !checkOutLocal) return true;
      effectiveIn = checkInLocal;
      effectiveOut = checkOutLocal;
    } else if (type === 'CHECK_IN') {
      if (!checkInLocal) return true;
      // 기존 퇴근이 없으면(= 아직 퇴근 전) 순서 검증 불가 → 통과
      if (!existingOut) return true;
      effectiveIn = checkInLocal;
      effectiveOut = existingOut;
    } else {
      // CHECK_OUT
      if (!checkOutLocal) return true;
      // 기존 출근이 없으면(= 출근 기록 없음) 순서 검증 불가 → 통과(서버가 업무 규칙으로 막을 수 있음)
      if (!existingIn) return true;
      effectiveIn = existingIn;
      effectiveOut = checkOutLocal;
    }

    const inMin = timeToMinutes(effectiveIn);
    const outMin = timeToMinutes(effectiveOut);
    if (Number.isNaN(inMin) || Number.isNaN(outMin)) return true;
    return inMin <= outMin;
  }, [type, checkInLocal, checkOutLocal, initialCheckInAt, initialCheckOutAt]);

  const canSubmit = useMemo(() => {
    if (!reason.trim()) return false;
    if (type === 'CHECK_IN') return !!checkInLocal;
    if (type === 'CHECK_OUT') return !!checkOutLocal;
    if (!checkInLocal || !checkOutLocal) return false;
    // BOTH일 때 출근<=퇴근 1차 가드
    return isTimeOrderValid;
  }, [type, checkInLocal, checkOutLocal, reason, isTimeOrderValid]);

  const missingHint = useMemo(() => {
    // 입력이 부족할 때 사용자가 왜 버튼이 비활성인지 바로 이해할 수 있도록 힌트 제공
    if (!reason.trim()) return '사유를 입력해 주세요.';
    if (type === 'CHECK_IN' && !checkInLocal)
      return '제안 출근 시간을 선택해 주세요.';
    if (type === 'CHECK_OUT' && !checkOutLocal)
      return '제안 퇴근 시간을 선택해 주세요.';
    if (type === 'BOTH' && (!checkInLocal || !checkOutLocal)) {
      return '제안 출근/퇴근 시간을 모두 선택해 주세요.';
    }
    if (type === 'BOTH' && !isTimeOrderValid) {
      return '출근 시간은 퇴근 시간보다 늦을 수 없습니다.';
    }
    if ((type === 'CHECK_IN' || type === 'CHECK_OUT') && !isTimeOrderValid) {
      return '출근 시간은 퇴근 시간보다 늦을 수 없습니다.';
    }
    return '';
  }, [type, checkInLocal, checkOutLocal, reason, isTimeOrderValid]);

  if (!open) return null;

  const submit = async () => {
    if (!canSubmit || loading) return;

    const proposedCheckInAt =
      type === 'CHECK_IN' || type === 'BOTH'
        ? toKstOffsetISOStringFromDateAndTime(workDate, checkInLocal)
        : null;
    const proposedCheckOutAt =
      type === 'CHECK_OUT' || type === 'BOTH'
        ? toKstOffsetISOStringFromDateAndTime(workDate, checkOutLocal)
        : null;

    setLoading(true);
    setMessage('');
    try {
      await apiFetch(
        `${baseUrl}/api/attendance/${attendanceId}/correction-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-USER-ID': String(userId),
          },
          body: JSON.stringify({
            type,
            proposedCheckInAt,
            proposedCheckOutAt,
            reason: reason.trim(),
          }),
        }
      );

      // 생성 성공 → 모달 닫고 목록 재조회
      onClose();
      onCreated();
    } catch (e) {
      setMessage(toUserMessage(e));
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
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">정정 요청</h2>
            <p className="text-xs text-gray-500">대상 날짜: {workDate}</p>
          </div>
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-gray-100"
            onClick={onClose}
            disabled={loading}
          >
            닫기
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">정정 유형</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as CorrectionType)}
            disabled={loading}
          >
            <option value="BOTH">출근/퇴근 모두</option>
            <option value="CHECK_IN">출근만</option>
            <option value="CHECK_OUT">퇴근만</option>
          </select>
        </div>

        {(type === 'CHECK_IN' || type === 'BOTH') && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              제안 출근 시간
            </label>
            <input
              type="time"
              className="w-full rounded border px-3 py-2"
              value={checkInLocal}
              onChange={(e) => setCheckInLocal(e.target.value)}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              현재 출근:{' '}
              {initialCheckInAt ? isoToLocalTime(initialCheckInAt) : '--:--'}
            </p>
          </div>
        )}

        {(type === 'CHECK_OUT' || type === 'BOTH') && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              제안 퇴근 시간
            </label>
            <input
              type="time"
              className="w-full rounded border px-3 py-2"
              value={checkOutLocal}
              onChange={(e) => setCheckOutLocal(e.target.value)}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              현재 퇴근:{' '}
              {initialCheckOutAt ? isoToLocalTime(initialCheckOutAt) : '--:--'}
            </p>
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">사유</label>
          <textarea
            className="w-full rounded border px-3 py-2"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            placeholder="정정 사유를 입력하세요"
          />
          {!loading && missingHint && (
            <p className="mt-1 text-xs text-gray-500">{missingHint}</p>
          )}
        </div>

        {message && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm">
            ❌ {message}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded bg-gray-100 px-3 py-2 hover:bg-gray-200"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            className="flex-1 rounded bg-black px-3 py-2 text-white disabled:opacity-50"
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
