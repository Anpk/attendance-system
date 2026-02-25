'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/app/context/AuthContext';

export default function AppHeader() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  // 로그아웃 이후 라우팅 안정화
  useEffect(() => {
    if (!ready) return;
    // user가 없어졌는데 현재 페이지가 보호 라우트면 각 페이지 가드가 처리하지만,
    // 헤더에서도 최소한의 안전 장치만 둔다.
  }, [ready, user]);

  const role = user?.role;
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';

  async function handleLogout() {
    try {
      logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href={isAdminOrManager ? '/admin/sites' : '/attendance'}
            className="text-base font-semibold"
          >
            근태관리
          </Link>

          <nav className="flex items-center gap-1 text-sm text-gray-700">
            {ready && user && isEmployee && (
              <>
                <Link
                  href="/attendance"
                  className="rounded px-2 py-1 hover:bg-gray-100"
                >
                  출/퇴근
                </Link>
                <Link
                  href="/attendance/report"
                  className="rounded px-2 py-1 hover:bg-gray-100"
                >
                  리포트
                </Link>
                <Link
                  href="/corrections"
                  className="rounded px-2 py-1 hover:bg-gray-100"
                >
                  정정
                </Link>
              </>
            )}

            {ready && user && isAdminOrManager && (
              <>
                <Link
                  href="/admin/sites"
                  className="rounded px-2 py-1 hover:bg-gray-100"
                >
                  관리자
                </Link>
                <Link
                  href="/attendance/report"
                  className="rounded px-2 py-1 hover:bg-gray-100"
                >
                  리포트
                </Link>
                <Link
                  href="/corrections"
                  className="rounded px-2 py-1 hover:bg-gray-100"
                >
                  정정
                </Link>
              </>
            )}

            {ready && !user && (
              <Link
                href="/login"
                className="rounded px-2 py-1 hover:bg-gray-100"
              >
                로그인
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {ready && user ? (
            <>
              <span className="text-gray-600">
                #{user.userId} · {user.role}
              </span>
              <button
                type="button"
                className="rounded border px-3 py-1 hover:bg-gray-50"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <span className="text-gray-500">&nbsp;</span>
          )}
        </div>
      </div>
    </header>
  );
}
