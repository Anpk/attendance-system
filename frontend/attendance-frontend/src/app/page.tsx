'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('Loading...');
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');

  useEffect(() => {
    fetch(`${baseUrl}/api/hello`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => setMessage(text))
      .catch((err) => {
        console.error(err);
        setMessage('❌ 백엔드 연결 실패 (콘솔 확인)');
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">프론트 ↔ 백엔드 연결 테스트</h1>
      <p className="text-lg">{message}</p>
    </main>
  );
}
