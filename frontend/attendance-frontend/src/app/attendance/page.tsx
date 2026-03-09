'use client';

import { useRequireAuth } from '../context/AuthContext';
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
} from 'react';

import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AttendanceActionResponse } from '@/lib/api/types';
import AppHeader from '@/app/_components/AppHeader';

function AttendancePageInner() {
  const { user, ready } = useRequireAuth();
  const router = useRouter();

  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewAction, setPreviewAction] = useState<'checkin' | 'checkout' | null>(null);
  const [previewError, setPreviewError] = useState<string>('');

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
  const checkOutFileInputRef = useRef<HTMLInputElement | null>(null);

  // 중복 클릭/연타로 동일 요청이 2번 전송되는 것을 방지하기 위한 동기 가드
  const inflightRef = useRef(false);

  // 어떤 액션이 처리 중인지 버튼 라벨에 반영하기 위한 ref
  const inflightActionRef = useRef<'checkin' | 'checkout' | null>(null);

  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCheckedIn = today.checkInAt !== null;
  const isCheckedOut = today.checkOutAt !== null;

  const isPreviewSubmitting =
    previewOpen &&
    previewAction !== null &&
    loading &&
    inflightActionRef.current === previewAction;

  function openPreview(action: 'checkin' | 'checkout', file: File) {
    setPreviewAction(action);
    setPreviewFile(file);
    setPreviewOpen(true);
    setPreviewError('');
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewFile(null);
    setPreviewAction(null);
    setPreviewError('');
  }

  function retakeFromPreview() {
    // 재선택/재촬영 시 기존 선택/에러를 정리하고 다시 선택하도록 유도
    setPreviewError('');
    setPreviewFile(null);
    if (previewAction === 'checkin') fileInputRef.current?.click();
    if (previewAction === 'checkout') checkOutFileInputRef.current?.click();
  }

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
    // any 금지: unknown을 안전하게 좁혀서 필요한 값만 추출
    const errObj =
      typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : {};
    const response =
      typeof errObj.response === 'object' && errObj.response !== null
        ? (errObj.response as Record<string, unknown>)
        : {};
    const data =
      typeof errObj.data === 'object' && errObj.data !== null
        ? (errObj.data as Record<string, unknown>)
        : {};

    const status =
      (typeof errObj.status === 'number' ? errObj.status : undefined) ??
      (typeof response.status === 'number' ? response.status : undefined);

    const code =
      (typeof errObj.code === 'string' ? errObj.code : undefined) ??
      (typeof response.code === 'string' ? response.code : undefined) ??
      (typeof data.code === 'string' ? data.code : undefined);

    const serverMessage =
      (typeof errObj.message === 'string' ? errObj.message : undefined) ??
      (typeof response.message === 'string' ? response.message : undefined) ??
      (typeof data.message === 'string' ? data.message : undefined);

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

  function PhotoConfirmModal(props: {
    open: boolean;
    title: string;
    file: File | null;
    error: string;
    submitting: boolean;
    onRetake: () => void;
    onCancel: () => void;
    onConfirm: () => void;
  }) {
    const { open, title, file, error, submitting, onRetake, onCancel, onConfirm } =
      props;

    const previewUrl = useMemo(() => {
      if (!file) return null;
      try {
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    }, [file]);

    useEffect(() => {
      return () => {
        if (previewUrl) {
          try {
            URL.revokeObjectURL(previewUrl);
          } catch {
            // ignore
          }
        }
      };
    }, [previewUrl]);

    if (!open) return null;

    const sizeLabel = (() => {
      if (!file) return '';
      const mb = file.size / (1024 * 1024);
      return `${mb.toFixed(2)}MB`;
    })();

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-busy={submitting}
        onMouseDown={(ev) => {
          if (submitting) return;
          if (ev.target === ev.currentTarget) onCancel();
        }}
      >
        <div className="w-full max-w-md rounded-lg bg-white p-4 shadow text-gray-900 dark:bg-gray-800 dark:text-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {file && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {file.name} · {sizeLabel}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={onCancel}
              disabled={submitting}
            >
              닫기
            </button>
          </div>

          <div className="mt-4">
            <div className="rounded border p-2 dark:border-gray-700">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="선택한 사진 미리보기"
                  className="max-h-80 w-full rounded object-contain"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-gray-600 dark:text-gray-300">
                  미리보기를 표시할 수 없습니다.
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">
              업로드 전에 사진을 확인하고, 필요하면 재선택/재촬영할 수 있습니다.
            </p>

            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                ❌ {error}
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded border px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              onClick={onRetake}
              disabled={submitting}
            >
              재선택/재촬영
            </button>
            <button
              type="button"
              className="flex-1 rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
              onClick={onConfirm}
              disabled={!file || submitting}
            >
              {submitting ? '업로드 중...' : '업로드'}
            </button>
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="w-full rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={onCancel}
              disabled={submitting}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 미리보기 모달: ESC로 닫기(업로드 중에는 닫기 금지)
  useEffect(() => {
    if (!previewOpen) return;

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return;
      if (isPreviewSubmitting) return;
      closePreview();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen, isPreviewSubmitting]);

  // ADMIN/MANAGER는 진입 차단
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      router.replace('/admin/sites');
    }
  }, [ready, user, router]);

  // 오늘 출근 상태 조회
  const fetchTodayAttendance = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch<AttendanceActionResponse>(
        `${baseUrl}/api/attendance/today`
      );
      setToday(data);
    } catch (e) {
      // today 조회 실패는 치명적 실패로 처리하지 않음(UX 정책)
      console.error('출근 상태 조회 실패', e);
    }
  }, [user, baseUrl]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    fetchTodayAttendance();
  }, [user, ready, baseUrl, fetchTodayAttendance]);

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

    setPreviewError('');
    openPreview('checkin', file);
  }

  // ✅ 옵션 A: 퇴근도 사진 업로드(멀티파트)
  async function checkOutWithPhoto(photo: File) {
    if (!user || loading || inflightRef.current) return;
    inflightRef.current = true;
    inflightActionRef.current = 'checkout';

    setLoading(true);
    setMessage('');

    try {
      const form = new FormData();
      form.append('photo', photo);

      const result = await apiFetch<AttendanceActionResponse>(
        `${baseUrl}/api/attendance/check-out`,
        {
          method: 'POST',
          body: form,
        }
      );

      setToday(result);
      setFlashMessage('✅ 처리되었습니다.');
    } catch (e) {
      setFlashMessage(`❌ ${toActionUserMessage(e)}`);
    } finally {
      inflightActionRef.current = null;
      inflightRef.current = false;
      setLoading(false);
      if (checkOutFileInputRef.current)
        checkOutFileInputRef.current.value = '';
    }
  }

  function handleCheckOutClick() {
    if (!user || loading || inflightRef.current || !isCheckedIn || isCheckedOut)
      return;
    checkOutFileInputRef.current?.click();
  }

  async function handleCheckOutPhotoSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFlashMessage('❌ 이미지 파일만 업로드할 수 있습니다.');
      if (checkOutFileInputRef.current)
        checkOutFileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setFlashMessage('❌ 이미지 파일만 업로드할 수 있습니다. (최대 5MB)');
      if (checkOutFileInputRef.current)
        checkOutFileInputRef.current.value = '';
      return;
    }

    setPreviewError('');
    openPreview('checkout', file);
  }

  async function confirmPreviewUpload() {
    if (!previewFile || !previewAction) return;
    // 재시도 시 기존 에러 제거
    setPreviewError('');

    try {
      if (previewAction === 'checkin') {
        await checkInWithPhoto(previewFile);
      } else {
        await checkOutWithPhoto(previewFile);
      }
      // 성공 시에만 닫기
      closePreview();
    } catch (e) {
      // 실패 시 모달 유지 + 에러 표시(재시도 가능)
      setPreviewError(toActionUserMessage(e));
    }
  }

  if (ready && user && (user.role === 'ADMIN' || user.role === 'MANAGER')) {
    return <div className="min-h-screen bg-gray-50" />;
  }

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

        {/* 출근 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handlePhotoSelected}
        />

        {/* 퇴근 파일 입력(옵션 A) */}
        <input
          ref={checkOutFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleCheckOutPhotoSelected}
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
            onClick={handleCheckOutClick}
          >
            {loading && inflightActionRef.current === 'checkout'
              ? '처리 중...'
              : '퇴근'}
          </button>
        </div>

        <PhotoConfirmModal
          open={previewOpen}
          title={previewAction === 'checkout' ? '퇴근 사진 확인' : '출근 사진 확인'}
          file={previewFile}
          error={previewError}
          submitting={isPreviewSubmitting}
          onRetake={retakeFromPreview}
          onCancel={closePreview}
          onConfirm={confirmPreviewUpload}
        />

        {message && <p className="text-lg">{message}</p>}
      </main>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AttendancePageInner />
    </Suspense>
  );
}
