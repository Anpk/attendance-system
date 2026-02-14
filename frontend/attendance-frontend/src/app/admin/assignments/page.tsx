'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminAssignmentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/sites?tab=employees');
  }, [router]);

  return null;
}
