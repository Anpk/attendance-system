'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

/**
 * 공용 헤더(최소)
 * - 링크로 출/퇴근(/attendance), 월별 목록(/attendance/monthly), 정정(/corrections) 이동
 * - 임시 로그인 환경에서 role 확인/로그아웃 제공
 */
export default function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/attendance" className="text-base font-semibold">
            근태관리
          </Link>
          {user && (
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
              #{user.userId} · {user.role}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/attendance"
            className="rounded px-2 py-1 hover:bg-gray-100"
          >
            출/퇴근
          </Link>
          <Link
            href="/attendance/monthly"
            className="rounded px-2 py-1 hover:bg-gray-100"
          >
            월별 목록
          </Link>
          <Link
            href="/corrections?tab=my"
            className="rounded px-2 py-1 hover:bg-gray-100"
          >
            정정
          </Link>

          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              로그아웃
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
