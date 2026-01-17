'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ApiError = {
  code: string;
  message: string;
};

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
    const res = await fetch(
      `http://localhost:8080/api/attendances/today?userId=${user.userId}`
    );

    if (res.ok) {
      // 여기서만 진짜 실패로 처리
      console.error('출근 상태 조회 실패', res.status);
      return;
    }

    const data: TodayAttendanceResponse = await res.json();
    setToday(data);
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
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.userId }),
      });

      if (!res.ok) {
        const error: ApiError = await res.json();
        setMessage(`❌ ${error.message}`);
        return;
      }

      setMessage('✅ 처리되었습니다.');
      await fetchTodayAttendance(); // 상태 즉시 반영
    } catch (e) {
      setMessage('❌ 서버 연결 실패');
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
          onClick={() => callApi('http://localhost:8080/api/attendances')}
        >
          출근
        </button>

        <button
          disabled={loading || !isCheckedIn || isCheckedOut}
          className="rounded bg-green-600 px-6 py-3 text-white disabled:opacity-50"
          onClick={() =>
            callApi('http://localhost:8080/api/attendances/check-out')
          }
        >
          퇴근
        </button>
      </div>

      {message && <p className="text-lg">{message}</p>}
    </main>
  );
}
