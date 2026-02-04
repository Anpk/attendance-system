'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const { login } = useAuth();
  const router = useRouter();

  const userIdNum = useMemo(() => {
    const n = Number(userId);
    return Number.isFinite(n) ? n : NaN;
  }, [userId]);

  function handleLogin() {
    // 임시 로그인(백엔드 연동 전): role도 선택 가능하도록
    login({ userId: userIdNum, role });
    router.push('/attendance');
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
        <label className="text-sm text-gray-700">역할</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded border px-4 py-2"
        >
          <option value="EMPLOYEE">EMPLOYEE</option>
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      <button
        onClick={handleLogin}
        className="rounded bg-blue-600 px-6 py-2 text-white disabled:opacity-50"
        disabled={!userId || !Number.isFinite(userIdNum)}
      >
        로그인
      </button>

      <p className="text-xs text-gray-500">테스트용 임시 로그인입니다.</p>
    </main>
  );
}
