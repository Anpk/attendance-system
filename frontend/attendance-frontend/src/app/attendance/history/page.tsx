'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

/**
 * Deprecated page.
 * - 정정 신청 기능이 리포트로 이관되면서 history 페이지는 더 이상 사용하지 않음.
 * - 직접 접근/북마크 호환을 위해 리다이렉트만 수행.
 */
export default function AttendanceHistoryPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login?next=%2Fattendance%2Fhistory');
      return;
    }

    // EMPLOYEE는 리포트로, ADMIN/MANAGER는 관리자 진입으로 유도
    if (user.role === 'EMPLOYEE') {
      router.replace('/attendance/report');
    } else {
      router.replace('/admin/sites');
    }
  }, [ready, user, router]);

  return <div className="min-h-screen bg-gray-50" />;
}
