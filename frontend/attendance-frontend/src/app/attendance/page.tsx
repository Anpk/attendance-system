'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isCheckedIn = today.checkedIn;
  const isCheckedOut = today.checkedOut;

  // 오늘 출근 상태 조회
  async function fetchTodayAttendance(userId: number) {
    try {
      const data = await apiFetch<TodayAttendanceResponse>(
        `http://localhost:8080/api/attendance/today?userId=${userId}`
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
    fetchTodayAttendance(user.userId);
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
      await fetchTodayAttendance(user.userId);
    } catch (e) {
      setMessage(`❌ ${toUserMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }

  // 체크인: 사진 업로드(멀티파트)로 처리
  async function checkInWithPhoto(photo: File) {
    if (!user || loading) return;

    setLoading(true);
    setMessage('');

    try {
      const form = new FormData();
      form.append('userId', String(user.userId));
      form.append('photo', photo);

      const result = await apiFetch<AttendanceActionResponse>(
        `${baseUrl}/api/attendance/check-in`,
        {
          method: 'POST',
          body: form, // apiFetch가 FormData를 그대로 전달(헤더 자동)
        }
      );

      setToday({
        checkedIn: result.checkInAt !== null,
        checkedOut: result.checkOutAt !== null,
        checkInTime: result.checkInAt,
        checkOutTime: result.checkOutAt,
      });

      setMessage('✅ 처리되었습니다.');
      await fetchTodayAttendance(user.userId);
    } catch (e) {
      setMessage(`❌ ${toUserMessage(e)}`);
    } finally {
      setLoading(false);
      // 같은 파일을 연속 선택해도 onChange가 동작하도록 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // 출근 버튼: 파일 선택창 열기
  function handleCheckInClick() {
    if (!user || loading || isCheckedIn) return;
    fileInputRef.current?.click();
  }

  // 파일 선택 후 업로드 실행
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return; // 선택 취소

    // (선택) 간단한 클라이언트 검증: 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      setMessage('❌ 이미지 파일만 업로드할 수 있습니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    await checkInWithPhoto(file);
  }

  async function checkOutWithRequestParam(url: string) {
    if (!user || loading) return;

    setLoading(true);
    setMessage('');

    try {
      const result = await apiFetch<AttendanceActionResponse>(url, {
        method: 'POST',
        // body 없음 (RequestParam 방식)
      });

      setToday({
        checkedIn: result.checkInAt !== null,
        checkedOut: result.checkOutAt !== null,
        checkInTime: result.checkInAt,
        checkOutTime: result.checkOutAt,
      });

      setMessage('✅ 처리되었습니다.');
      await fetchTodayAttendance(user.userId);
    } catch (e) {
      setMessage(`❌ ${toUserMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const handleCheckOut = () =>
    checkOutWithRequestParam(
      `${baseUrl}/api/attendance/check-out?userId=${user!.userId}`
    );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">근태 관리</h1>

      <p className="text-gray-600">로그인 사용자 ID: {user?.userId}</p>

      {/* 숨김 파일 입력: 출근 버튼이 클릭 트리거 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="flex gap-4">
        <button
          disabled={loading || isCheckedIn}
          className="rounded bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
          onClick={handleCheckInClick}
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
