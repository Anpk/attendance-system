'use client';

import Link from 'next/link';

/**
 * 공용 헤더(최소)
 * - 링크로 출/퇴근(/attendance), 월별 목록(/attendance/month) 이동
 */
export default function AppHeader() {
  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/attendance" className="text-base font-semibold">
          근태관리
        </Link>

        <nav className="flex gap-3 text-sm">
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
            href="/corrections"
            className="rounded px-2 py-1 hover:bg-gray-100"
          >
            정정
          </Link>
        </nav>
      </div>
    </header>
  );
}
