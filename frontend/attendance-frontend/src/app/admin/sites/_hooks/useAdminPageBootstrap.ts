'use client';

import { useEffect } from 'react';

type UserLite = { userId: number; role: string } | null;

type Params = {
  ready: boolean;
  user: UserLite;
  forbidden: boolean;
  tab: 'sites' | 'employees' | 'report';

  sitesCount: number;
  refreshSites: () => Promise<void> | void;

  refreshEmployees: () => Promise<void> | void;
  setIsCreateEmployeeOpen: (v: boolean) => void;

  showAssignmentsUi: boolean;
  editingUserId: number | null;
  refreshManagerAssignments: (managerUserId: number) => Promise<void> | void;
};

export function useAdminPageBootstrap(params: Params) {
  // initial load: sites
  useEffect(() => {
    if (!params.ready) return;
    if (!params.user) return;
    if (params.forbidden) return;
    params.refreshSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ready, params.user, params.forbidden]);

  // employees tab entry
  useEffect(() => {
    if (!params.ready) return;
    if (!params.user) return;
    if (params.forbidden) return;
    if (params.tab !== 'employees') return;

    params.setIsCreateEmployeeOpen(false);

    if (params.sitesCount === 0) {
      params.refreshSites();
    }
    params.refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab, params.ready, params.user, params.forbidden]);

  // assignments load when editing manager (admin only)
  useEffect(() => {
    if (!params.ready) return;
    if (!params.user) return;
    if (params.forbidden) return;
    if (!params.showAssignmentsUi) return;
    if (params.editingUserId == null) return;

    params.refreshManagerAssignments(params.editingUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.showAssignmentsUi,
    params.editingUserId,
    params.ready,
    params.user,
    params.forbidden,
  ]);
}
