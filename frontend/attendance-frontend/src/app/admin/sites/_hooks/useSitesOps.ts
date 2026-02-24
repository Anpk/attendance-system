'use client';

import { useState } from 'react';
import { toUserMessage } from '@/lib/api/error-messages';
import type { AdminSiteResponse } from '@/lib/api/types';
import {
  adminCreateSite,
  adminListSites,
  adminUpdateSite,
} from '@/lib/api/admin';

type UserLite = { userId: number; role: string } | null;

type Params = {
  user: UserLite;
  setLoading: (v: boolean) => void;
  setFlashMessage: (msg: string) => void;
};

export function useSitesOps({ user, setLoading, setFlashMessage }: Params) {
  const [sites, setSites] = useState<AdminSiteResponse[]>([]);
  const [createName, setCreateName] = useState('');
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteActive, setEditSiteActive] = useState<boolean>(true);

  async function refreshSites() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await adminListSites();
      setSites(data);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitCreateSite() {
    if (!user) return;
    if (user.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    const name = createName.trim();
    if (!name) {
      setFlashMessage('site name은 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      await adminCreateSite({ name });
      setCreateName('');
      await refreshSites();
      setFlashMessage('Site가 생성되었습니다.');
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function startEditSite(s: AdminSiteResponse) {
    setEditingSiteId(s.siteId);
    setEditSiteName(s.name);
    setEditSiteActive(s.active);
  }

  function cancelEditSite() {
    setEditingSiteId(null);
    setEditSiteName('');
    setEditSiteActive(true);
  }

  async function submitUpdateSite(siteId: number) {
    if (!user) return;
    setLoading(true);
    try {
      const body = {
        name: editSiteName.trim(),
        active: editSiteActive,
      };
      const updated = await adminUpdateSite(siteId, body);
      setSites((prev) => prev.map((x) => (x.siteId === siteId ? updated : x)));
      setFlashMessage('Site가 수정되었습니다.');
      cancelEditSite();
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    sites,
    setSites,

    createName,
    setCreateName,

    editingSiteId,
    editSiteName,
    editSiteActive,

    setEditingSiteId,
    setEditSiteName,
    setEditSiteActive,

    refreshSites,
    submitCreateSite,
    startEditSite,
    cancelEditSite,
    submitUpdateSite,
  } as const;
}
