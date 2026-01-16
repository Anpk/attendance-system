'use client';

import { useState } from 'react';

type ApiError = {
  code: string;
  message: string;
};

export default function AttendancePage() {
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 임시: 인증 붙기 전까지 고정 userId
  const userId = 1;

  async function callApi(url: string) {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const error: ApiError = await res.json();
        setMessage(`❌ ${error.message}`);
        return;
      }

      setMessage('✅ 처리되었습니다.');
    } catch (e) {
      setMessage('❌ 서버 연결 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">근태 관리</h1>

      <div className="flex gap-4">
        <button
          className="rounded bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
          disabled={loading}
          onClick={() => callApi('http://localhost:8080/api/attendances')}
        >
          출근
        </button>

        <button
          className="rounded bg-green-600 px-6 py-3 text-white disabled:opacity-50"
          disabled={loading}
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