'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/app/_components/AppHeader';
import { useAuth } from '@/app/context/AuthContext';

/**
 * Deprecated page.
 * - 월별 근태 목록 페이지는 더 이상 사용하지 않음(리포트로 통합).
 * - 직접 접근/북마크 호환을 위해 리다이렉트만 수행.
 */
export default function AttendanceMonthPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace('/login?next=%2Fattendance%2Fmonthly');
      return;
    }

    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      router.replace('/admin/sites');
      return;
    }

    // EMPLOYEE: 리포트로 통합
    router.replace('/attendance/report');
  }, [ready, user, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
    </div>
  );
}
