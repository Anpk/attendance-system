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
      const loginUrl = '/login';
      try {
        // ✅ 현재 히스토리 엔트리를 login으로 교체하여 뒤로가기 혼선을 최소화
        window.history.replaceState(null, '', loginUrl);
      } catch {
        // ignore
      }
      router.replace(loginUrl);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Row 1 (mobile) / Left (desktop): brand + user */}
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <Link
            href={isAdminOrManager ? '/admin/sites' : '/attendance'}
            className="text-base font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100"
          >
            근태관리
          </Link>

          <div className="flex items-center gap-2 text-sm">
            {ready && user ? (
              <>
                <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  #{user.userId} · {user.role}
                </span>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 whitespace-nowrap dark:border-gray-700 dark:hover:bg-gray-800"
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

        {/* Row 2 (mobile) / Right (desktop): nav links, no-wrap with horizontal scroll */}
        <nav className="flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-gray-800 dark:text-gray-200 sm:overflow-visible">
          {ready && user && isEmployee && (
            <>
              <Link
                href="/attendance"
                className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
              >
                출/퇴근
              </Link>
              <Link
                href="/attendance/report"
                className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
              >
                리포트
              </Link>
              <Link
                href="/corrections"
                className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
              >
                정정
              </Link>
            </>
          )}

          {ready && user && isAdminOrManager && (
            <>
              <Link
                href="/admin/sites"
                className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
              >
                관리자
              </Link>
              <Link
                href="/attendance/report"
                className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
              >
                리포트
              </Link>
              <Link
                href="/corrections"
                className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
              >
                정정
              </Link>
            </>
          )}

          {ready && !user && (
            <Link
              href="/login"
              className="rounded px-2 py-1 hover:bg-gray-100 whitespace-nowrap dark:hover:bg-gray-800"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
