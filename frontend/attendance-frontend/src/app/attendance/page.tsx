'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AttendanceActionResponse } from '@/lib/api/types';
import AppHeader from '@/app/_components/AppHeader';

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 메시지 자동 해제(모바일 UX): 너무 오래 남지 않도록 TTL 적용
  const MESSAGE_TTL_MS = 4000;

  // 서버 업로드 정책과 정합(최대 5MB)
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

  const todayStr = useMemo(() => {
    // 로컬 기준 날짜를 "YYYY-MM-DD"로 생성
    // toISOString() 사용 시 타임존(UTC) 영향으로 날짜가 하루 밀릴 수 있어 수동 생성
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [today, setToday] = useState<AttendanceActionResponse>({
    attendanceId: null,
    workDate: todayStr,
    checkInAt: null,
    checkOutAt: null,
    isCorrected: false,
  });

  // 환경변수 기반 API Base URL
  // - NEXT_PUBLIC_ 접두사: 브라우저에서 접근 가능
  // - 미설정 시 로컬 기본값 사용
  const baseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 중복 클릭/연타로 동일 요청이 2번 전송되는 것을 방지하기 위한 동기 가드
  const inflightRef = useRef(false);

  // 어떤 액션이 처리 중인지 버튼 라벨에 반영하기 위한 ref
  const inflightActionRef = useRef<'checkin' | 'checkout' | null>(null);

  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCheckedIn = today.checkInAt !== null;
  const isCheckedOut = today.checkOutAt !== null;

  function setFlashMessage(next: string) {
    // 새 메시지가 들어오면 기존 타이머는 항상 정리
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }

    setMessage(next);

    // 빈 메시지는 타이머 불필요
    if (!next) return;

    // TTL 후 자동 해제
    messageTimerRef.current = setTimeout(() => {
      setMessage('');
      messageTimerRef.current = null;
    }, MESSAGE_TTL_MS);
  }

  function toActionUserMessage(e: unknown): string {
    // 업로드/액션 공통 에러 메시지 톤 통일
    const anyErr = e as any;
    const status = anyErr?.status ?? anyErr?.response?.status;
    const code = anyErr?.code ?? anyErr?.response?.code ?? anyErr?.data?.code;
    const serverMessage =
      anyErr?.message ?? anyErr?.response?.message ?? anyErr?.data?.message;

    // 422: 업로드/요청값 오류는 정책 문구로 표준화
    if (status === 422 || code === 'INVALID_REQUEST_PAYLOAD') {
      return '이미지 파일만 업로드할 수 있습니다. (최대 5MB)';
    }

    // 409: 비즈니스 충돌은 서버 메시지를 사용자 안내로 그대로 사용(톤만 통일)
    if (status === 409) {
      return serverMessage || '요청을 처리할 수 없습니다.';
    }

    // 401: 인증 누락
    if (status === 401) {
      return '인증이 필요합니다.';
    }

    // 그 외는 기존 매퍼 사용
    return toUserMessage(e);
  }

  // 오늘 출근 상태 조회
  async function fetchTodayAttendance() {
    if (!user) return;
    try {
      const data = await apiFetch<AttendanceActionResponse>(
        `${baseUrl}/api/attendance/today`,
        {
          headers: { 'X-USER-ID': String(user.userId) },
        }
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
      return;
    }

    // 로그인 된 경우만 오늘 출근 상태 조회
    fetchTodayAttendance();
  }, [user, router, baseUrl]);

  // 체크인: 사진 업로드(멀티파트)로 처리
  async function checkInWithPhoto(photo: File) {
    if (!user || loading || inflightRef.current) return;
    inflightRef.current = true;
    inflightActionRef.current = 'checkin';

    setLoading(true);
    setMessage('');

    try {
      const form = new FormData();
      form.append('photo', photo);

      const result = await apiFetch<AttendanceActionResponse>(
        `${baseUrl}/api/attendance/check-in`,
        {
          method: 'POST',
          body: form, // apiFetch가 FormData를 그대로 전달(헤더 자동)
          headers: { 'X-USER-ID': String(user.userId) },
        }
      );

      // 성공 DTO 기반 즉시 UI 반영 (Today Snapshot 통일)
      setToday(result);

      setFlashMessage('✅ 처리되었습니다.');
    } catch (e) {
      setFlashMessage(`❌ ${toActionUserMessage(e)}`);
    } finally {
      inflightActionRef.current = null;
      inflightRef.current = false;
      setLoading(false);
      // 같은 파일을 연속 선택해도 onChange가 동작하도록 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // 출근 버튼: 파일 선택창 열기
  function handleCheckInClick() {
    if (!user || loading || inflightRef.current || isCheckedIn) return;
    fileInputRef.current?.click();
  }

  // 파일 선택 후 업로드 실행
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return; // 선택 취소

    // 간단한 클라이언트 검증: 이미지 + 최대 5MB
    if (!file.type.startsWith('image/')) {
      setFlashMessage('❌ 이미지 파일만 업로드할 수 있습니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setFlashMessage('❌ 이미지 파일만 업로드할 수 있습니다. (최대 5MB)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    await checkInWithPhoto(file);
  }

  async function checkOutWithRequestParam(url: string) {
    if (!user || loading || inflightRef.current) return;
    inflightRef.current = true;
    inflightActionRef.current = 'checkout';

    setLoading(true);
    setMessage('');

    try {
      const result = await apiFetch<AttendanceActionResponse>(url, {
        method: 'POST',
        headers: { 'X-USER-ID': String(user.userId) },
      });

      setToday(result);

      setFlashMessage('✅ 처리되었습니다.');
    } catch (e) {
      setFlashMessage(`❌ ${toActionUserMessage(e)}`);
    } finally {
      inflightActionRef.current = null;
      inflightRef.current = false;
      setLoading(false);
    }
  }

  const handleCheckOut = () =>
    checkOutWithRequestParam(`${baseUrl}/api/attendance/check-out`);

  if (!baseUrl) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">근태 관리</h1>
        <p className="text-red-600">
          NEXT_PUBLIC_API_BASE_URL 환경변수가 설정되지 않았습니다.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        <h1 className="text-2xl font-bold">출/퇴근</h1>

        <p className="text-gray-600">로그인 사용자 ID: {user?.userId}</p>

        {/* 숨김 파일 입력: 출근 버튼이 클릭 트리거 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelected}
        />

        <div className="flex gap-4">
          <button
            disabled={loading || isCheckedIn}
            aria-busy={loading}
            className="rounded bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
            onClick={handleCheckInClick}
          >
            {loading && inflightActionRef.current === 'checkin'
              ? '처리 중...'
              : '출근'}
          </button>

          <button
            disabled={loading || !isCheckedIn || isCheckedOut}
            aria-busy={loading}
            className="rounded bg-green-600 px-6 py-3 text-white disabled:opacity-50"
            onClick={handleCheckOut}
          >
            {loading && inflightActionRef.current === 'checkout'
              ? '처리 중...'
              : '퇴근'}
          </button>
        </div>

        {message && <p className="text-lg">{message}</p>}
      </main>
    </div>
  );
}
