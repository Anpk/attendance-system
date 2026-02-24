'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type UseAdminTabParams<T extends string> = {
  /** Base path without query string. e.g. '/admin/sites' */
  basePath: string;
  /** Default tab when query param is absent/invalid */
  defaultTab: T;
  /** Allowed tab keys */
  allowedTabs: readonly T[];
  /** Query parameter name (default: 'tab') */
  paramName?: string;
};

export function useAdminTab<T extends string>(params: UseAdminTabParams<T>) {
  const router = useRouter();
  const sp = useSearchParams();

  const paramName = params.paramName ?? 'tab';

  const allowed = useMemo(
    () => new Set<string>(params.allowedTabs as readonly string[]),
    [params.allowedTabs]
  );

  const getTabFromSearch = (): T => {
    const raw = sp.get(paramName);
    if (!raw) return params.defaultTab;
    if (!allowed.has(raw)) return params.defaultTab;
    return raw as T;
  };

  const [tab, setTab] = useState<T>(() => getTabFromSearch());

  // URL 변경(뒤로가기 등) 시 tab 동기화
  useEffect(() => {
    const next = getTabFromSearch();
    if (next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  function setTabAndSync(next: T) {
    setTab(next);
    const url = `${params.basePath}?${paramName}=${encodeURIComponent(next)}`;
    router.replace(url);
  }

  return { tab, setTabAndSync } as const;
}
