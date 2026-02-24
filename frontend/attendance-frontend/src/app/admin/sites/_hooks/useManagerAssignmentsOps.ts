'use client';

import { useMemo, useState } from 'react';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AdminSiteResponse } from '@/lib/api/types';
import {
  adminAssignManagerSite,
  adminListManagerSites,
  adminRemoveManagerSite,
} from '@/lib/api/admin';

type UserLite = { userId: number; role: string } | null;

type Params = {
  user: UserLite;
  sites: AdminSiteResponse[];
  setLoading: (v: boolean) => void;
  setFlashMessage: (msg: string) => void;
};

export function useManagerAssignmentsOps({
  user,
  sites,
  setLoading,
  setFlashMessage,
}: Params) {
  const [mgrAssignedSiteIds, setMgrAssignedSiteIds] = useState<number[]>([]);
  const [isAssignmentsOpen, setIsAssignmentsOpen] = useState<boolean>(false);
  const [mgrSelectedSiteIds, setMgrSelectedSiteIds] = useState<number[]>([]);
  const [mgrSiteQuery, setMgrSiteQuery] = useState<string>('');

  const mgrDelta = useMemo(() => {
    const current = new Set(mgrAssignedSiteIds);
    const desired = new Set(mgrSelectedSiteIds);
    const toAdd = Array.from(desired).filter((id) => !current.has(id));
    const toRemove = Array.from(current).filter((id) => !desired.has(id));
    return { toAdd, toRemove };
  }, [mgrAssignedSiteIds, mgrSelectedSiteIds]);

  function resetAssignmentsUi() {
    setMgrAssignedSiteIds([]);
    setIsAssignmentsOpen(false);
    setMgrSelectedSiteIds([]);
    setMgrSiteQuery('');
  }

  async function refreshManagerAssignments(managerUserId: number) {
    if (user?.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    setLoading(true);
    try {
      const ids = await adminListManagerSites(managerUserId);
      setMgrAssignedSiteIds(ids);
      setMgrSelectedSiteIds(ids);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function applyManagerAssignments(managerUserId: number) {
    if (user?.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }

    const current = new Set(mgrAssignedSiteIds);
    const desired = new Set(mgrSelectedSiteIds);

    const toAdd = Array.from(desired).filter((id) => !current.has(id));
    const toRemove = Array.from(current).filter((id) => !desired.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      setFlashMessage('변경 사항이 없습니다.');
      return;
    }

    // 비활성 site는 신규 할당 금지
    const inactiveAdd = toAdd.find((id) => {
      const s = sites.find((x) => x.siteId === id);
      return s ? !s.active : false;
    });
    if (inactiveAdd != null) {
      setFlashMessage('비활성 site는 할당할 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      for (const siteId of toAdd) {
        await adminAssignManagerSite({ managerUserId, siteId });
      }
      for (const siteId of toRemove) {
        await adminRemoveManagerSite(managerUserId, siteId);
      }

      setFlashMessage('담당 site가 업데이트되었습니다.');
      await refreshManagerAssignments(managerUserId);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    mgrAssignedSiteIds,
    setMgrAssignedSiteIds,

    isAssignmentsOpen,
    setIsAssignmentsOpen,

    mgrSelectedSiteIds,
    setMgrSelectedSiteIds,

    mgrSiteQuery,
    setMgrSiteQuery,

    mgrDelta,

    resetAssignmentsUi,
    refreshManagerAssignments,
    applyManagerAssignments,
  } as const;
}
