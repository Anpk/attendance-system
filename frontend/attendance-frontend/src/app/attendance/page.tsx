'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';

type AttendanceStatus = {
  id: number;
  checkInTime: string;
  checkOutTime: string | null;
} | null;

type TodayAttendanceResponse = {
  checkedIn: boolean;
  checkedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
};

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceStatus>(null);
  const [today, setToday] = useState<TodayAttendanceResponse>({
    checkedIn: false,
    checkedOut: false,
    checkInTime: null,
    checkOutTime: null,
  });

  // 오늘 출근 상태 조회
  async function fetchTodayAttendance() {
    try {
      const data = await apiFetch<TodayAttendanceResponse>(
        `http://localhost:8080/api/attendance/today?userId=${user.userId}`
      );
      setToday(data);
    } catch (e) {
      // today 조회 실패는 UX 정책상 "치명적 실패"가 아닐 수 있으니, 일단 메시지/로그만 남김
      console.error('출근 상태 조회 실패', e);
    }
  }

  useEffect(() => {
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
      await apiFetch<void>(url, {
        method: 'POST',
        body: { userId: user.userId },
      });

      setMessage('✅ 처리되었습니다.');
      await fetchTodayAttendance(); // 상태 즉시 반영
    } catch (e) {
      setMessage(`❌ ${toUserMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const isCheckedIn = today.checkedIn;
  const isCheckedOut = today.checkedOut;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">근태 관리</h1>

      <p className="text-gray-600">로그인 사용자 ID: {user?.userId}</p>

      <div className="flex gap-4">
        <button
          disabled={loading || isCheckedIn}
          className="rounded bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
          onClick={() => callApi('http://localhost:8080/api/attendance')}
        >
          출근
        </button>

        <button
          disabled={loading || !isCheckedIn || isCheckedOut}
          className="rounded bg-green-600 px-6 py-3 text-white disabled:opacity-50"
          onClick={() =>
            callApi('http://localhost:8080/api/attendance/check-out')
          }
        >
          퇴근
        </button>
      </div>

      {message && <p className="text-lg">{message}</p>}
    </main>
  );
}
