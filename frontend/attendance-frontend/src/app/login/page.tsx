'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  function handleLogin() {
    // 임시 로그인 (백엔드 연동 전)
    login({
      userId: Number(userId),
      role: 'EMPLOYEE',
    });

    router.push('/attendance');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">로그인</h1>

      <input
        type="number"
        placeholder="사번 입력"
        className="border px-4 py-2 rounded"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="rounded bg-blue-600 px-6 py-2 text-white"
        disabled={!userId}
      >
        로그인
      </button>
    </main>
  );
}
