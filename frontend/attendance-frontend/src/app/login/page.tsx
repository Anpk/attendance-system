'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

import { apiFetch } from '@/lib/api/client';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AuthLoginResponse } from '@/lib/api/types';

type ParsedUser = {
  userId: number;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
};

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  return raw.replace(/\/+$/, '');
}

function parseJwtUser(token: string): ParsedUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // base64url -> base64
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad !== 0) return null;

    const json = atob(b64);
    const payload = JSON.parse(json) as Record<string, unknown>;

    const sub = payload.sub;
    const role = payload.role;

    const userId =
      typeof sub === 'number'
        ? sub
        : typeof sub === 'string' && sub.trim().length > 0
          ? Number(sub)
          : NaN;

    if (!Number.isFinite(userId)) return null;
    if (role !== 'EMPLOYEE' && role !== 'MANAGER' && role !== 'ADMIN')
      return null;

    return { userId, role };
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const userIdNum = useMemo(() => {
    const n = Number(userId);
    return Number.isFinite(n) ? n : NaN;
  }, [userId]);

  const canSubmit =
    userId.trim().length > 0 &&
    Number.isFinite(userIdNum) &&
    password.trim().length > 0;

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'expired') {
      setMessage('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
  }, [searchParams]);

  function getSafeNext(): string | null {
    const raw = searchParams.get('next');
    if (!raw) return null;
    // ✅ open redirect 방지: 상대 경로만 허용
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//')) return null;
    return raw;
  }

  async function handleLogin() {
    setMessage('');

    if (!Number.isFinite(userIdNum) || password.trim().length === 0) {
      setMessage('사번/비밀번호를 확인해 주세요.');
      return;
    }

    try {
      const res = await apiFetch<AuthLoginResponse>(
        `${getApiBaseUrl()}/api/auth/login`,
        {
          method: 'POST',
          body: { userId: userIdNum, password: password.trim() },
        }
      );

      if (!res?.accessToken) {
        setMessage('로그인 응답을 해석할 수 없습니다.');
        return;
      }

      // ✅ Bearer 토큰 저장(탭 단위)
      sessionStorage.setItem('accessToken', res.accessToken);

      const parsed = parseJwtUser(res.accessToken);
      if (!parsed) {
        setMessage('로그인 응답을 해석할 수 없습니다.');
        return;
      }

      // ✅ role 기반 UI를 위해 user 저장 + token 저장
      login(parsed, res.accessToken);

      const next = getSafeNext();

      // 기본 랜딩: ADMIN은 월별 근태 목록으로, 그 외는 출/퇴근으로
      const defaultAfterLogin =
        parsed.role === 'ADMIN' ? '/attendance/monthly' : '/attendance';

      router.replace(next ?? defaultAfterLogin);
    } catch (e) {
      setMessage(toUserMessage(e));
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">로그인</h1>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <label className="text-sm text-gray-700">사번</label>
        <input
          type="number"
          placeholder="사번 입력"
          className="rounded border px-4 py-2"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <label className="text-sm text-gray-700">비밀번호</label>
        <input
          type="password"
          placeholder="비밀번호 입력"
          className="rounded border px-4 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button
        onClick={handleLogin}
        className="rounded bg-blue-600 px-6 py-2 text-white disabled:opacity-50"
        disabled={!canSubmit}
      >
        로그인
      </button>

      {message ? (
        <p className="max-w-xs text-center text-sm text-red-600">{message}</p>
      ) : null}

      <p className="text-xs text-gray-500">사번/비밀번호로 로그인합니다.</p>
    </main>
  );
}
