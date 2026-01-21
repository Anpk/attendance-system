'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import type {
  AttendanceActionResponse,
  TodayAttendanceResponse,
} from '@/lib/api/types';

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [today, setToday] = useState<TodayAttendanceResponse>({
    checkedIn: false,
    checkedOut: false,
    checkInTime: null,
    checkOutTime: null,
  });

  // 환경변수 기반 API Base URL
  // - NEXT_PUBLIC_ 접두사: 브라우저에서 접근 가능
  // - 미설정 시 로컬 기본값 사용
  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  }, []);

  const isCheckedIn = today.checkedIn;
  const isCheckedOut = today.checkedOut;

  // 오늘 출근 상태 조회
  async function fetchTodayAttendance() {
    try {
      const data = await apiFetch<TodayAttendanceResponse>(
        `http://localhost:8080/api/attendance/today?userId=${user.userId}`
      );
      setToday(data);
    } catch (e) {
      // today 조회 실패는 치명적 실패로 처리하지 않음(UX 정책)
      console.error('출근 상태 조회 실패', e);
    }
  }

  useEffect(() => {
    // 로그인 전/로그아웃 상태면 로그인 페이지로 보냄
    if (!user) {
      router.push('/login');
    }

    // 로그인 된 경우만 오늘 출근 상태 조회
    fetchTodayAttendance();
  }, [user, router]);

  async function callApi(url: string) {
    if (!user || loading) return;

    setLoading(true);
    setMessage('');

    try {
      const result = await apiFetch<AttendanceActionResponse>(url, {
        method: 'POST',
        body: { userId: user.userId },
      });

      // 성공 DTO 기반 즉시 UI 반영
      setToday({
        checkedIn: result.checkInAt !== null,
        checkedOut: result.checkOutAt !== null,
        checkInTime: result.checkInAt,
        checkOutTime: result.checkOutAt,
      });

      setMessage('✅ 처리되었습니다.');

      // 안정화 단계: 서버 최종값으로 재동기화(필요 시 추후 제거 가능)
      await fetchTodayAttendance();
    } catch (e) {
      setMessage(`❌ ${toUserMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const handleCheckIn = () => callApi(`${baseUrl}/api/attendance/check-in`);
  const handleCheckOut = () => callApi(`${baseUrl}/api/attendance/check-out`);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">근태 관리</h1>

      <p className="text-gray-600">로그인 사용자 ID: {user?.userId}</p>

      <div className="flex gap-4">
        <button
          disabled={loading || isCheckedIn}
          className="rounded bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
          onClick={handleCheckIn}
        >
          출근
        </button>

        <button
          disabled={loading || !isCheckedIn || isCheckedOut}
          className="rounded bg-green-600 px-6 py-3 text-white disabled:opacity-50"
          onClick={handleCheckOut}
        >
          퇴근
        </button>
      </div>

      {message && <p className="text-lg">{message}</p>}
    </main>
  );
}
